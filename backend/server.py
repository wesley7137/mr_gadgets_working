import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import logging
from utils.stt.stt import audio_to_text
import requests
from TTS.api import TTS
import torch
from fastapi.responses import FileResponse

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_tts(text: str) -> bytes:
    model_name = "tts_models/en/ljspeech/tacotron2-DDC"
    tts = TTS(model_name)
    wav = tts.tts(text)
    return wav

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

    async def send_audio(self, websocket: WebSocket, audio_data: bytes):
        try:
            await websocket.send_bytes(audio_data)
            print("Sent audio data")
        except RuntimeError as e:
            logger.error(f"Failed to send audio: {e}")

manager = WebSocketManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("Connected to websocket")
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.receive" and "bytes" in message:
                audio_data = message["bytes"]
                print("Received audio data")
                text = audio_to_text(audio_data)
                response_text = await query_llm(text)
                audio_data = generate_tts(response_text)
                await manager.send_message(websocket, response_text)
                await manager.send_message(websocket, '{"status": 200, "message": "TTS Generation Success"}')

            elif message["type"] == "websocket.receive" and "text" in message:
                text = message["text"]
                response_text = await query_llm(text)
                audio_data = generate_tts(response_text)
                await manager.send_message(websocket, response_text)
                await manager.send_message(websocket, '{"status": 200, "message": "TTS Generation Success"}')
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error handling websocket: {e}")

@app.get("/audio/{audio_file_name}")
async def get_audio(audio_file_name: str):
    print(f"Received request for audio file: {audio_file_name}")
    file_path = f"{audio_file_name}"
    print(f"Serving audio file from: {file_path}")
    return FileResponse(file_path, media_type="audio/wav")

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
    uvicorn.run(app, host="0.0.0.0", port=8015)
