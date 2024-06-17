import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
import uvicorn
import logging
from utils.stt.stt import audio_to_text
from fastapi.responses import FileResponse
from queue import Queue
from threading import Thread
import os
from datetime import datetime
from TTS.api import TTS
import torch
import tempfile
import requests

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

manager = WebSocketManager()

# Initialize the audio queue
audio_queue = Queue()

async def generate_tts_and_enqueue(websocket: WebSocket, response_text: str):
    sentences = response_text.split('. ')
    for sentence in sentences:
        sentence = sentence.strip()
        if sentence:
            timestamp = datetime.now().strftime("%m-%d-%Y-%I_%M%p-%f")
            filename = f"audio_files/{timestamp}.wav"
            try:
                tts.tts_to_file(
                    text=sentence + '.',  # Ensure each chunk ends with a period
                    speaker_wav="D:\\mr_gadget_nexus3\\backend\\utils\\tts\\colin.wav",
                    file_path=filename,
                    speed=0.9,
                    temperature=0.3,
                    top_k=75,
                    top_p=0.9,
                    split_sentences=True,
                    language="en"
                )
                print(f"Generated TTS file: {filename}")
                audio_queue.put(filename)
                await manager.send_audio_info(websocket, os.path.basename(filename))
                return 200, (f"Generated TTS file: {filename}")
            except Exception as e:
                print(f"Error generating TTS: {e}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("Connected to websocket")
    try:
        while True:
            message = await websocket.receive()
            print(f"Message received: {message}")
        
            if message["type"] == "websocket.receive" and "bytes" in message:
                audio_data = message["bytes"]
                print("Received audio data")
            
                text = audio_to_text(audio_data)
                print(f"Converted audio to text: {text}")
            
                response_text = await query_llm(text)
                print(f"Response from LLM: {response_text}")
            
                await manager.send_message(websocket, response_text)
                await generate_tts_and_enqueue(websocket, response_text)
        
            elif message["type"] == "websocket.receive" and "text" in message:
                text = message["text"]
                print(f"Received text: {text}")
            
                response_text = await query_llm(text)
                print(f"Response from LLM: {response_text}")
            
                await manager.send_message(websocket, response_text)
                await generate_tts_and_enqueue(websocket, response_text)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error handling websocket: {e}")

@app.get("/audio/{audio_file_name}")
async def get_audio(audio_file_name: str):
    print(f"Received request for audio file: {audio_file_name}")
    file_path = f"audio_files/{audio_file_name}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    print(f"Serving audio file from: {file_path}")
    return FileResponse(file_path, media_type="audio/wav")

async def query_llm(text: str):
    try:
        from openai import OpenAI
        client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")

        completion = client.chat.completions.create(
            model="model-identifier",
            messages=[
                {"role": "system", "content": "You are an AI personal assistant that is connected to the user via their mobile device."},
                {"role": "user", "content": text}
            ],
            temperature=0.3,
        )

        response = completion.choices[0].message.content
        return response
    
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error occurred: {e}")
        return "An error occurred while querying the language model."
    except Exception as e:
        logger.error(f"General error occurred: {e}")
        return "A general error occurred while querying the language model."

if __name__ == "__main__":
    logger.info("Starting WebSocket server...")
    uvicorn.run(app, host="0.0.0.0", port=8015)
