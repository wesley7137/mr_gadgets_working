# backend/main.py
import asyncio
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import logging
from queue import Queue, Empty
from threading import Thread
from datetime import datetime
from TTS.api import TTS
import torch
import io
import llm
from utils.stt.stt import audio_to_text
import os
import time
from fastapi import FastAPI, HTTPException

from pydantic import BaseModel

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Define the AudioData model
class AudioData(BaseModel):
    audio_bytes: bytes  # Use str if you're sending base64-encoded data



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

    async def send_text_message(self, websocket: WebSocket, message: str):
        try:
            print(f"Sending text message: {message}")
            await websocket.send_text(message)
            print("Sent text message")
        except RuntimeError as e:
            logger.error(f"Failed to send text message: {e}")

manager = WebSocketManager()

# Initialize the audio queue
audio_queue = Queue()

async def send_audio_data_async(websocket, audio_data):
    try:
        print(f"send_audio_data_async: Sending {len(audio_data)} bytes of audio data as base64 string.")
        await manager.send_base64_audio_data(websocket, audio_data)
    except Exception as e:
        print(f"Error sending audio data: {e}")

def old_tts_worker():
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

                        asyncio.run(send_audio_data_async(websocket, audio_data))
                    except Exception as e:
                        print(f"Error generating TTS: {e}")
            audio_queue.task_done()
        except Empty:
            continue

# Start TTS worker thread
thread = Thread(target=old_tts_worker, daemon=True)
thread.start()



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
                    try:
                        print(f"Sending response text for sentence: {sentence}")
                        asyncio.run(send_text_message_async(websocket, sentence))
                    except Exception as e:
                        print(f"Error sending response text: {e}")
            audio_queue.task_done()
        except Empty:
            continue

async def send_text_message_async(websocket, message):
    try:
        print(f"send_text_message_async: Sending text message.")
        await manager.send_text_message(websocket, message)
    except Exception as e:
        print(f"Error sending text message: {e}")






@app.post("/api/chat_completions")
async def chat_completions_endpoint(audio_data: AudioData):
    try:
        print("Received audio data")

        # Decode base64 audio bytes
        audio_bytes = base64.b64decode(audio_data.audio_bytes)
        print(f"Decoded audio to bytes: {len(audio_bytes)} bytes")

        # Convert received audio bytes to text
        text = audio_to_text(audio_bytes)
        print(f"Converted audio to text: {text}")

        # Query LLM with the text
        response = await llm.query_llm(text, session_id="0001")
        response_string = response.content
        print(f"Response from LLM: {response_string}")

        return {"response": response_string}
    except Exception as e:
        print(f"Error handling chat completions: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    
    


@app.websocket("/ws/to_backend_llm_generation")
async def websocket_send_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("Connected to websocket for sending")
    try:
        while True:
            message = await websocket.receive_bytes()
            print(f"Received audio data, length: {len(message)}")

            # Convert received audio bytes to text
            text = audio_to_text(message)
            print(f"Converted audio to text: {text}")

            # Query LLM with the text
            response = await llm.query_llm(text, session_id="0001")
            response_string = response.content
            print(f"Response from LLM: {response_string}")

            # Queue the response for TTS processing
            audio_queue.put((websocket, response_string))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error handling send websocket: {e}")

@app.websocket("/ws/receive_audio_data_llm_generation")
async def websocket_receive_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("Connected to websocket for receiving")
    try:
        while True:
            await asyncio.sleep(1)  # Keep the connection open
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error handling receive websocket: {e}")






if __name__ == "__main__":
    logger.info("Starting WebSocket server...")
    uvicorn.run(app, host="0.0.0.0", port=8015)
