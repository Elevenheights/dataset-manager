@echo off
echo ========================================
echo   Qwen 2.5 VL Caption Service Starter
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python not found! Please install Python 3.10 or higher.
    pause
    exit /b 1
)

REM Load environment variables if .env.caption exists
if exist ".env.caption" (
    echo Loading configuration from .env.caption
    for /f "usebackq tokens=1,2 delims==" %%a in (".env.caption") do (
        if not "%%a"=="#" (
            set %%a=%%b
        )
    )
)

REM Check model location (dev mode or production)
if defined DEV_MODEL_PATH (
    echo.
    echo ======================
    echo  DEV MODE ENABLED
    echo ======================
    echo Using model from: %DEV_MODEL_PATH%
    echo.
    if not exist "%DEV_MODEL_PATH%" (
        echo ERROR: Model file not found at %DEV_MODEL_PATH%
        echo.
        echo Please download Qwen2.5-VL-7B-Instruct-Q8_0.gguf and update .env.caption
        echo Download from: https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct-GGUF
        echo.
        pause
        exit /b 1
    )
) else (
    echo.
    echo Production mode: Looking for model in default location
    echo Expected: /workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf
    echo.
    echo NOTE: For local development, copy .env.caption.example to .env.caption
    echo       and set DEV_MODEL_PATH to your local model path
    echo.
)

REM Check if virtual environment exists
if not exist "venv_caption" (
    echo Creating virtual environment...
    python -m venv venv_caption
    if errorlevel 1 (
        echo Error: Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo Activating virtual environment...
call venv_caption\Scripts\activate.bat

REM Install/upgrade requirements
echo.
echo Installing/upgrading dependencies...
echo This may take a few minutes on first run...
python -m pip install --upgrade pip
pip install -r requirements_caption.txt

if errorlevel 1 (
    echo.
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Starting Caption Service
echo ========================================
echo.
echo Service will run on: http://localhost:11435
echo Press Ctrl+C to stop the service
echo.

REM Start the caption service
python caption_service.py

REM Deactivate virtual environment on exit
call venv_caption\Scripts\deactivate.bat

