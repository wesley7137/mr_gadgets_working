import asyncio
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
import uvicorn
import logging
from utils.stt.stt import audio_to_text
from fastapi.responses import FileResponse
from queue import Queue, Empty
from threading import Thread
import os
from datetime import datetime
from TTS.api import TTS
import torch
import requests
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

    async def send_message(self, websocket: WebSocket, message: str):
        try:
            await websocket.send_text(message)
            print(f"Sent message: {message}")
        except RuntimeError as e:
            logger.error(f"Failed to send message: {e}")

    async def send_audio_info(self, websocket: WebSocket, filename: str):
        try:
            await websocket.send_text(f'{{"status": 200, "message": "TTS Generation Success", "filename": "{filename}"}}')
            print(f"Sent success message with filename: {filename}")
        except RuntimeError as e:
            logger.error(f"Failed to send audio info: {e}")

    async def send_audio_data(self, websocket: WebSocket, audio_data: bytes):
        try:
            await websocket.send_bytes(audio_data)
            print("Sent audio data")
        except RuntimeError as e:
            logger.error(f"Failed to send audio data: {e}")

manager = WebSocketManager()

# Initialize the audio queue
audio_queue = Queue()

async def send_audio_data_async(websocket, filename):
    try:
        with open(filename, 'rb') as file:
            audio_data = file.read()
            await manager.send_audio_data(websocket, audio_data)
    except Exception as e:
        print(f"Error sending audio data: {e}")

def tts_worker():
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
                    timestamp = datetime.now().strftime("%m-%d-%Y-%I_%M%p-%f")
                    filename = f"audio_files/{timestamp}.wav"
                    try:
                        tts.tts_to_file(
                            text=sentence,
                            speaker_wav="D:\\mr_gadget_nexus3\\backend\\utils\\tts\\colin.wav",
                            file_path=filename,
                            speed=0.9,
                            temperature=0.3,
                            top_k=75,
                            top_p=0.9,
                            language="en"
                        )
                        print(f"Generated TTS file: {filename}")
                        asyncio.run(send_audio_data_async(websocket, filename))
                    except Exception as e:
                        print(f"Error generating TTS: {e}")
            audio_queue.task_done()
        except Empty:
            continue


# Start TTS worker thread
thread = Thread(target=tts_worker, daemon=True)
thread.start()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("Connected to websocket")
    try:
        while True:
            message = await websocket.receive()
            print(f"Message received: {message}")

            if message["type"] == "websocket.receive" and "text" in message:
                audio_data = message["text"]
                print("Received audio data")

                # Decode Base64 audio data
                decoded_audio = base64.b64decode(audio_data)

                # Convert decoded audio to text
                text = audio_to_text(decoded_audio)
                print(f"Converted audio to text: {text}")

                response = await llm.query_llm(text, session_id="0001")
                response_string = response.content
                print(f"Response from LLM: {response_string}")

                await manager.send_message(websocket, response_string)
                audio_queue.put((websocket, response_string))
            elif message["type"] == "websocket.receive" and "text" in message:
                text = message["text"]
                print(f"Received text: {text}")

                response = await llm.query_llm(text, session_id="0001")
                response_string = response.content

                print(f"Response from LLM: {response_string}")

                await manager.send_message(websocket, response_string)
                audio_queue.put((websocket, response_string))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error handling websocket: {e}")
        
        
        
@app.get("/{audio_file_name}")
async def get_audio(audio_file_name: str):
    print(f"Received request for audio file: {audio_file_name}")
    file_path = f"audio_files/{audio_file_name}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    print(f"Serving audio file from: {file_path}")
    return FileResponse(file_path, media_type="audio/wav")




if __name__ == "__main__":
    logger.info("Starting WebSocket server...")
    uvicorn.run(app, host="0.0.0.0", port=8015)
