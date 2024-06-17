# backend/server.py

import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import logging
from utils.stt.stt import audio_to_text
from utils.tts.tts_simple import generate_tts
import requests
from TTS.api import TTS
import torch



app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self.active_connections = []
        print("WebSocketManager initialized")

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print("Connected to websocket")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print("Disconnected from websocket")

    async def send_message(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)
        print(f"Sent message: {message}")

    async def send_audio(self, audio_data: bytes):
        for connection in self.active_connections:
            await connection.send_bytes(audio_data)
        print("Sent audio data")

manager = WebSocketManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("Connected to websocket")
    try:
        while True:
            message = await websocket.receive()
            print(f"Received message: {message}")
            if message["type"] == "websocket.receive" and "bytes" in message:
                audio_data = message["bytes"]
                print("Received audio data")
                text = audio_to_text(audio_data)
                print(f"Converted audio to text: {text}")
                response_text = await query_llm(text)
                print(f"Received response from LLM: {response_text}")
                if is_code(response_text):
                    await manager.send_message(response_text)
                    print("Sent code response")
                else:
                    audio_file = generate_tts(response_text)
                    with open(audio_file, 'rb') as f:
                        audio_content = f.read()
                    print("Generated TTS audio")
                    await manager.send_audio(audio_content)
                    print("Sent audio response")
            elif message["type"] == "websocket.receive" and "text" in message:
                text = message["text"]
                print(f"Received text: {text}")
                response_text = await query_llm(text)
                print(f"Received response from LLM: {response_text}")
                if is_code(response_text):
                    await manager.send_message(response_text)
                    print("Sent code response")
                else:
                    audio_file = generate_tts(response_text)
                    with open(audio_file, 'rb') as f:
                        audio_content = f.read()
                    print("Generated TTS audio")
                    await manager.send_audio(audio_content)
                    print("Sent audio response")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Disconnected from websocket")
    except Exception as e:
        logger.error(f"Error handling websocket: {e}")
        await manager.send_message("An error occurred while processing your request.")

async def query_llm(text: str):
    try:
        from openai import OpenAI

        # Point to the local server
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

def is_code(text: str) -> bool:
    return "def " in text or "import " in text or "class " in text or text.strip().startswith("<")

if __name__ == "__main__":
    logger.info("Starting WebSocket server...")
    uvicorn.run(app, host="0.0.0.0", port=8008)
