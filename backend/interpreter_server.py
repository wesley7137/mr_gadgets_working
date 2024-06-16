from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from interpreter import interpreter
import uvicorn

app = FastAPI()

@app.get("/chat")
def chat_endpoint(message: str):
    def event_stream():
        for result in interpreter.chat(message, stream=True):
            yield f"data: {result}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/history")
def history_endpoint():
    return {"messages": interpreter.messages}

@app.get("/status")
def status_endpoint():
    return {"status": "running"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8009)
