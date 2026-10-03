@echo off
REM Arranca el tablero. Requiere haber corrido antes:
REM     python -m venv .venv
REM     .venv\Scripts\pip install -r requirements.txt
cd /d "%~dp0"
.venv\Scripts\python.exe -m backend.app
