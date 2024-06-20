import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import logging
from queue import Queue, Empty
from threading import Thread
import io
from TTS.api import TTS
import torch
import base64
import json
from utils.stt.stt import audio_to_text
import llm
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
        print("Connected to websocket")

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [conn for conn in self.active_connections if conn != websocket]
        print("Disconnected from websocket")

    async def _send_audio_info(self, websocket: WebSocket, bytes_data: bytes):
        try:
            base64_data = base64.b64encode(bytes_data).decode('utf-8')
            data = {
                'audio': base64_data
            }
            json_data = json.dumps(data)
            await websocket.send_text(json_data)
            print("Sent audio data")
        except RuntimeError as e:
            logger.error(f"Failed to send audio info: {e}")

    def send_audio_info(self, websocket: WebSocket, bytes_data: bytes):
        loop = asyncio.get_event_loop()
        future = asyncio.run_coroutine_threadsafe(self._send_audio_info(websocket, bytes_data), loop)
        try:
            future.result()
        except Exception as e:
            logger.error(f"Error sending audio info: {e}")

manager = WebSocketManager()

audio_queue = Queue()

def tts_worker(loop):
    asyncio.set_event_loop(loop)
    while True:
        try:
            item = audio_queue.get(timeout=1)
            if item is None:
                continue

            websocket, response_text = item
            sentences = response_text.split('. ')
            for sentence in sentences:
                sentence = sentence.strip()
                print(f"Processing sentence: {sentence}")
                if sentence:
                    try:
                        bytes_buffer = io.BytesIO()
                        print("Generating TTS for sentence")
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
                        bytes_data = bytes_buffer.getvalue()
                        print(f"Generated TTS byte data for sentence: {bytes_data[:10]}...{bytes_data[-10:]}")
                        bytes_buffer.close()
                        print(f"Generated TTS byte data for sentence: {sentence}")
                        asyncio.run_coroutine_threadsafe(manager._send_audio_info(websocket, bytes_data), loop)
                    except Exception as e:
                        print(f"Error generating TTS: {e}")

            audio_queue.task_done()
        except Empty:
            continue

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("Connected to websocket")
    try:
        while True:
            message = await websocket.receive()
            print(f"Message received: {message}")

            if "type" in message and message["type"] == "websocket.receive" and "bytes" in message:
                audio_data = message["bytes"]
                print(f"Received audio data of length {len(audio_data)}")

                try:
                    text = audio_to_text(audio_data)
                    print(f"Converted audio to text: {text}")

                    response = await llm.query_llm(text, session_id="0001")
                    response_string = response.content
                    print(f"Response from LLM: {response_string}")

                    # Put the response in the queue for TTS generation
                    audio_queue.put((websocket, response_string))
                except Exception as e:
                    print(f"Error processing audio data: {e}")

            elif "type" in message and message["type"] == "websocket.receive" and "text" in message:
                text = message["text"]
                print(f"Received text: {text}")

                response = await llm.query_llm(text, session_id="0001")
                response_string = response.content

                print(f"Response from LLM: {response_string}")

                # Put the response in the queue for TTS generation
                audio_queue.put((websocket, response_string))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error handling websocket: {e}")

if __name__ == "__main__":
    logger.info("Starting WebSocket server...")
    main_loop = asyncio.get_event_loop()
    thread = Thread(target=tts_worker, args=(main_loop,), daemon=True)
    thread.start()
    uvicorn.run(app, host="0.0.0.0", port=8015)
