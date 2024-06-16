@echo off
:: Batch script to start all required processes

:: Set the conda environment name
set CONDA_ENV=repochat

:: Set the paths to your Python scripts
set BACKEND_SERVER_PATH=backend\server.py
set INTERPRETER_PROCESS_PATH=backend\interpreter_server.py

:: Set the command to start the local LLM model
set LLM_COMMAND="ollama run deepseek-coder:33b-instruct-q6_k"

:: Set the frontend directory (where package.json is located)
set FRONTEND_DIR=gadget_frontend

:: Activate conda environment
echo Activating conda environment...
call conda activate %CONDA_ENV%

:: Start the local LLM model
echo Starting local LLM model...
start cmd /k %LLM_COMMAND%

:: Wait a bit to ensure the LLM model starts
timeout /t 5 /nobreak > nul

:: Start the interpreter process
echo Starting interpreter process...
start cmd /k "python %INTERPRETER_PROCESS_PATH%"

:: Start the frontend server
echo Starting frontend server...
start cmd /k "python %BACKEND_SERVER_PATH%"

:: Change directory to the frontend and start npm
echo Starting frontend...
start cmd /k "cd %FRONTEND_DIR% && npm start"

echo All processes started.
pause
