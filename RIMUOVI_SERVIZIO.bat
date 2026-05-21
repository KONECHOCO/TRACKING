@echo off
title TRACKING MM - Rimozione Servizio Windows
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERRORE] Esegui come AMMINISTRATORE!
    pause & exit /b 1
)

set APP_DIR=%~dp0
set SERVICE_NAME=TrackingMMOperations

echo  Arresto e rimozione servizio...
"%APP_DIR%nssm.exe" stop %SERVICE_NAME%
"%APP_DIR%nssm.exe" remove %SERVICE_NAME% confirm

echo.
echo  Servizio rimosso correttamente.
pause
