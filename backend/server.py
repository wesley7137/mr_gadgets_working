# server.py
import asyncio
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import logging
from queue import Queue, Empty
from threading import Thread
import io
import json
from TTS.api import TTS
import torch
import llm
from utils.stt.stt import audio_to_text

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

device = "cuda:0" if torch.cuda.is_available() else "cpu"
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

class WebSocketManager:
    def __init__(self):
        self.active_connections = []
        print("WebSocketManager initialized")

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Connected to websocket: {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [conn for conn in self.active_connections if conn != websocket]
        print(f"Disconnected from websocket: {websocket.client}")

    async def send_message(self, websocket: WebSocket, message: dict):
        try:
            # Send JSON string
            await websocket.send_text(json.dumps(message))
            print(f"Sent message: {message['type']}")
        except RuntimeError as e:
            logger.error(f"Failed to send message: {e}")

manager = WebSocketManager()

# Initialize the audio queue
audio_queue = Queue()

async def process_audio_queue():
    while True:
        try:
            item = audio_queue.get(timeout=1)  # Get item from queue
            if item is None:
                continue

            websocket, response_text = item
            sentences = response_text.split('. ')
            for sentence in sentences:
                sentence = sentence.strip()
                if sentence:
                    try:
                        print(f"Generating TTS for sentence: {sentence}")
                        bytes_buffer = io.BytesIO()
                        tts.tts_to_file(
                            text=sentence,
                            speaker_wav="D:\\mr_gadget_nexus3\\backend\\utils\\tts\\colin.wav",
                            file_path=bytes_buffer,
                            speed=0.9,
                            temperature=0.3,
                            top_k=75,
                            top_p=0.9,
                            language="en"
                        )
                        audio_data = bytes_buffer.getvalue()
                        bytes_buffer.close()
                        print(f"TTS generated for sentence: {sentence}, {len(audio_data)} bytes")

                        base64_audio = base64.b64encode(audio_data).decode('utf-8')
                        await manager.send_message(websocket, {
                            'type': 'audio',
                            'audio': base64_audio
                        })
                    except Exception as e:
                        print(f"Error generating TTS: {e}")
            audio_queue.task_done()
        except Empty:
            await asyncio.sleep(0.1)  # Sleep briefly to avoid busy-waiting

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("Connected to websocket")
    try:
        while True:
            message = await websocket.receive_text()
            data = json.loads(message)  # Parse JSON string
            print(f"Received message: {data}")
            
            if data['type'] == 'audio':
                audio_bytes = base64.b64decode(data['audio'])
                print(f"Received audio data, length: {len(audio_bytes)}")

                # Convert received audio bytes to text
                text = audio_to_text(audio_bytes)
                print(f"Converted audio to text: {text}")

                # Send the transcribed text back to the client
                await manager.send_message(websocket, {
                    'type': 'text',
                    'text': text
                })

                # Query LLM with the text
                response = await llm.query_llm(text, session_id="0001")
                response_string = response.content
                print(f"Response from LLM: {response_string}")

                # Send the LLM response text back to the client
                await manager.send_message(websocket, {
                    'type': 'text',
                    'text': response_string
                })

                # Queue the response for TTS processing
                audio_queue.put((websocket, response_string))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error handling websocket: {e}")

def start_audio_processing_loop():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(process_audio_queue())

if __name__ == "__main__":
    logger.info("Starting WebSocket server...")
    # Start the audio processing loop in a separate thread
    Thread(target=start_audio_processing_loop, daemon=True).start()
    # Run the Uvicorn server
    uvicorn.run(app, host="0.0.0.0", port=8015, log_level="info")
