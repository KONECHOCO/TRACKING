@echo off
title TRACKING MM - Installazione Servizio Windows
echo.
echo  ============================================
echo   TRACKING MM Operations - Servizio Windows
echo  ============================================
echo.

:: Verifica privilegi amministratore
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERRORE] Esegui questo file come AMMINISTRATORE!
    echo  Tasto destro sul file -> "Esegui come amministratore"
    pause
    exit /b 1
)

set APP_DIR=%~dp0
:: Rileva Python automaticamente
for /f "delims=" %%i in ('where python') do set PYTHON=%%i
if not defined PYTHON (
    echo  [ERRORE] Python non trovato! Installa Python prima.
    pause & exit /b 1
)
set SERVICE_NAME=TrackingMMOperations

echo  [1/3] Rimozione servizio precedente (se esiste)...
"%APP_DIR%nssm.exe" stop %SERVICE_NAME% 2>nul
"%APP_DIR%nssm.exe" remove %SERVICE_NAME% confirm 2>nul

echo  [2/3] Installazione servizio Windows...
"%APP_DIR%nssm.exe" install %SERVICE_NAME% "%PYTHON%" "-m uvicorn main:app --host 0.0.0.0 --port 8080"
"%APP_DIR%nssm.exe" set %SERVICE_NAME% AppDirectory "%APP_DIR%"
"%APP_DIR%nssm.exe" set %SERVICE_NAME% DisplayName "TRACKING MM Operations"
"%APP_DIR%nssm.exe" set %SERVICE_NAME% Description "Dashboard Tracking MM Operations - Spedizioni in tempo reale"
"%APP_DIR%nssm.exe" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%APP_DIR%nssm.exe" set %SERVICE_NAME% AppStdout "%APP_DIR%logs\service.log"
"%APP_DIR%nssm.exe" set %SERVICE_NAME% AppStderr "%APP_DIR%logs\service_error.log"
"%APP_DIR%nssm.exe" set %SERVICE_NAME% AppRotateFiles 1
"%APP_DIR%nssm.exe" set %SERVICE_NAME% AppRotateSeconds 86400

:: Crea cartella log
if not exist "%APP_DIR%logs" mkdir "%APP_DIR%logs"

echo  [3/3] Avvio servizio...
"%APP_DIR%nssm.exe" start %SERVICE_NAME%

echo.
echo  ============================================
echo   Servizio installato e avviato!
echo   La dashboard e' accessibile su:
echo   http://localhost:8080
echo.
echo   Si avvia automaticamente ad ogni riavvio.
echo  ============================================
echo.
pause
