import asyncio
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
import uvicorn
import logging
from queue import Queue, Empty
from threading import Thread
import io
import json
import requests
from utils.stt.stt import audio_to_text
from utils.tts.model_loader import TTSModel
from llm import query_llm

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# TTS initialization
try:
    tts = TTSModel.get_instance()  # Get the TTS model instance
    logger.info("TTS model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load TTS model: {e}")
    raise

# Initialize the audio queue
audio_queue = Queue()
should_reset = False

INTERPRETER_URL = "http://localhost:8001/chat"
FINN_URL = "http://localhost:1234/v1/chat/completions"
INTERPRETER_KILL_URL = "http://localhost:8001/kill"

class WebSocketManager:
    def __init__(self):
        self.active_connections = []
        logger.info("WebSocketManager initialized")

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Connected to websocket: {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [conn for conn in self.active_connections if conn != websocket]
        logger.info(f"Disconnected from websocket: {websocket.client}")

    async def send_message(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_text(json.dumps(message))
            logger.info(f"Sent message: {message['type']}")
        except RuntimeError as e:
            logger.error(f"Failed to send message: {e}")

manager = WebSocketManager()

async def process_audio_queue():
    while True:
        try:
            item = audio_queue.get(timeout=1)
            if item is None:
                continue

            websocket, response_text = item
            logger.info(f"Processing response for TTS: {response_text}")

            # Process response in smaller chunks for real-time latency
            chunks = response_text.split('. ')
            for chunk in chunks:
                chunk = chunk.strip()
                if chunk:
                    try:
                        logger.info(f"Generating TTS for chunk: {chunk}")
                        bytes_buffer = io.BytesIO()
                        tts.tts_to_file(
                            text=chunk,
                            speaker_wav="D:\\mr_gadget_nexus3\\backend\\utils\\tts\\jake.wav",
                            file_path=bytes_buffer,
                            speed=1.6,
                            temperature=1.0,
                            top_k=95,
                            top_p=0.9,
                            language="en"
                        )
                        audio_data = bytes_buffer.getvalue()
                        bytes_buffer.close()
                        logger.info(f"TTS generated for chunk: {chunk}, {len(audio_data)} bytes")

                        base64_audio = base64.b64encode(audio_data).decode('utf-8')
                        await manager.send_message(websocket, {
                            'type': 'audio',
                            'audio': base64_audio
                        })
                        logger.info("Sent TTS audio data to websocket")
                    except Exception as e:
                        logger.error(f"Error generating TTS: {e}")

            audio_queue.task_done()
        except Empty:
            await asyncio.sleep(0.1)






async def handle_websocket(websocket: WebSocket, model: str):
    await manager.connect(websocket)
    print(f"Connected to {model} websocket")
    try:
        while True:
            message = await websocket.receive_text()
            data = json.loads(message)
            print(f"Received message: {data}")

            if data['type'] == 'reset':
                global should_reset
                print("Received reset command")
                should_reset = True
                continue

            if data['type'] == 'audio':
                audio_bytes = base64.b64decode(data['audio'])
                print(f"Received audio data, length: {len(audio_bytes)}")

                text = audio_to_text(audio_bytes)
                print(f"Converted audio to text: {text}")

                await manager.send_message(websocket, {
                    'type': 'text',
                    'text': text
                })

                response = await query_llm(text, session_id=f"{model}_0001")
                response_string = response.content
                print(f"Response from LLM: {response_string}")

                # Enqueue the response for audio processing
                audio_queue.put((websocket, response_string))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error handling websocket: {e}")




@app.websocket("/ws/interpreter")
async def websocket_interpreter(websocket: WebSocket):
    await handle_websocket(websocket, "interpreter")

@app.websocket("/ws/finn")
async def websocket_finn(websocket: WebSocket):
    await handle_websocket(websocket, "finn")

@app.post("/kill_interpreter")
def kill_interpreter():
    logger.info("Triggering kill switch on Open Interpreter...")
    response = requests.post(INTERPRETER_KILL_URL)
    if response.status_code == 200:
        logger.info("Kill switch successfully activated")
        return {"status": "Success", "detail": "Kill switch activated"}
    else:
        logger.error("Failed to activate kill switch")
        raise HTTPException(status_code=response.status_code, detail="Failed to activate kill switch")

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