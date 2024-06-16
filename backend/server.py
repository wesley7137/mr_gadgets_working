# backend/server.py

import asyncio
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from utils.stt.stt import audio_to_text
from utils.tts.tts import text_to_audio
from interpreter import interpreter
import uvicorn

app = FastAPI()

class WebSocketManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

    async def send_audio(self, audio_data: bytes):
        for connection in self.active_connections:
            await connection.send_bytes(audio_data)

manager = WebSocketManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.receive" and "bytes" in message:
                audio_data = message["bytes"]
                text = audio_to_text(audio_data.decode('utf-8'))
                response_text = await query_llm(text)
                if is_code(response_text):
                    await manager.send_message(response_text)
                else:
                    audio_data = text_to_audio(response_text)
                    await manager.send_audio(audio_data)
            elif message["type"] == "websocket.receive" and "text" in message:
                text = message["text"]
                response_text = await query_llm(text)
                if is_code(response_text):
                    await manager.send_message(response_text)
                else:
                    audio_data = text_to_audio(response_text)
                    await manager.send_audio(audio_data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def query_llm(text: str):
    response = interpreter.chat(text)
    return response

def is_code(text: str) -> bool:
    return "def " in text or "import " in text or "class " in text or text.strip().startswith("<")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8008)
