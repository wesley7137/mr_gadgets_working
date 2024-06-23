import os
import signal
import threading
from interpreter import interpreter
from flask import Flask, request, jsonify

app = Flask(__name__)

# Set up the interpreter
interpreter.llm.temperature = 0.1
interpreter.offline = True
interpreter.llm.model = "openai/x"
interpreter.llm.api_key = "fake_key"
interpreter.llm.api_base = "http://localhost:1234/v1"
interpreter.llm.supports_functions = False
interpreter.llm.supports_vision = False
interpreter.auto_run = False
interpreter.llm.execution_instructions = "To be provided."
interpreter.llm.context_window = 16000
interpreter.loop = True
interpreter.safe_mode = 'ask'
interpreter.custom_instructions = "This is a custom instruction."
interpreter.user_message_template = "{content} Please send me some code that would be able to answer my question, in the form of ```python\n... the code ...\n``` or ```shell\n... the code ...\n```"
interpreter.always_apply_user_message_template = False
interpreter.code_output_template = "Code output: {content}\nWhat does this output mean / what's next (if anything, or are we done)?"
interpreter.empty_code_output_template = "The code above was executed on my machine. It produced no text output. what's next (if anything, or are we done?)"
interpreter.code_output_sender = "user"

# Set the SERVER environment variable to start the built-in server
os.environ["SERVER"] = "true"

@app.route('/kill', methods=['POST'])
def kill_server():
    def shutdown():
        os.kill(os.getpid(), signal.SIGINT)
    
    threading.Thread(target=shutdown).start()
    return jsonify({"message": "Server shutdown initiated"}), 200

if __name__ == "__main__":
    # Start the interpreter in a separate thread
    interpreter_thread = threading.Thread(target=interpreter.chat, args=("Start the server",))
    interpreter_thread.start()

    print("Open Interpreter server is running on http://localhost:8080")
    
    # Start the Flask app for the kill switch
    app.run(port=8081, debug=True, use_reloader=True)
