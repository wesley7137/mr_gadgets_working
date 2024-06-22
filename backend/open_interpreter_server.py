from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
import uvicorn
import asyncio
import threading
import os
import signal
import sys
import logging
from interpreter import interpreter as base_interpreter

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def initialize_interpreter():
    try:
        interpreter_instance = base_interpreter
        logger.info("Base interpreter instance created")

        # Set the properties
        interpreter_instance.llm.temperature = 0.1
        interpreter_instance.offline = True
        interpreter_instance.llm.model = "ollama/deepseek-coder:33b-instruct-q6_k"
        interpreter_instance.llm.api_key = "fake_key"
        interpreter_instance.llm.api_base = "http://localhost:11434"
        interpreter_instance.llm.supports_functions = False
        interpreter_instance.llm.supports_vision = False
        interpreter_instance.llm.force_task_completion = True
        interpreter_instance.auto_run = True
        interpreter_instance.llm.execution_instructions = "To be provided."
        interpreter_instance.llm.context_window = 16000
        interpreter_instance.loop = True
        interpreter_instance.safe_mode = 'ask'
        interpreter_instance.custom_instructions = "This is a custom instruction."
        interpreter_instance.user_message_template = "{content} Please send me some code that would be able to answer my question, in the form of ```python\n... the code ...\n``` or ```shell\n... the code ...\n```"
        interpreter_instance.always_apply_user_message_template = False
        interpreter_instance.code_output_template = "Code output: {content}\nWhat does this output mean / what's next (if anything, or are we done)?"
        interpreter_instance.empty_code_output_template = "The code above was executed on my machine. It produced no text output. what's next (if anything, or are we done?)"
        interpreter_instance.code_output_sender = "user"

        logger.info("Interpreter initialized with custom settings")
        return interpreter_instance
    except Exception as e:
        logger.error(f"Failed to initialize interpreter: {e}")
        raise

# Initialize the interpreter with the specified settings
interpreter = initialize_interpreter()

app = FastAPI()

def chunked_event_stream(generator, chunk_size=1024):
    try:
        buffer = ""
        for result in generator:
            buffer += result
            if len(buffer) >= chunk_size:
                yield f"data: {buffer}\n\n"
                buffer = ""
        if buffer:
            yield f"data: {buffer}\n\n"
    except Exception as e:
        logger.error(f"Error in chunked event stream: {e}")
        yield f"data: Error occurred in event stream\n\n"

@app.post("/chat")
async def chat_endpoint(request: Request):
    try:
        data = await request.json()
        message = data.get("message", "")
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        logger.info(f"Received message for interpretation: {message}")

        generator = interpreter.chat(message, stream=False)
        logger.info("Generated response from interpreter")
        return StreamingResponse(chunked_event_stream(generator), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Error in chat_endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history")
def history_endpoint():
    try:
        logger.info("Returning conversation history")
        return interpreter.messages
    except Exception as e:
        logger.error(f"Error retrieving conversation history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/kill")
def kill_server():
    try:
        logger.info("Kill switch activated, stopping server...")
        threading.Thread(target=stop_server).start()
        return {"status": "Terminating server"}
    except Exception as e:
        logger.error(f"Error activating kill switch: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def stop_server():
    try:
        pid = os.getpid()
        logger.info(f"Terminating process with PID: {pid}")
        os.kill(pid, signal.SIGINT)
    except Exception as e:
        logger.error(f"Error stopping server: {e}")

if __name__ == "__main__":
    logger.info("Starting Open Interpreter server...")
    try:
        uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        sys.exit(1)
