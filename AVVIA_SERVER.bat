@echo off
title TRACKING MM Operations - Server
echo.
echo  ====================================
echo   TRACKING MM Operations - Avvio
echo  ====================================
echo.
echo  Avvio server in corso...
echo  Apri il browser su: http://localhost:8080
echo.
cd /d "%~dp0"
python -m uvicorn main:app --host 0.0.0.0 --port 8080
pause
