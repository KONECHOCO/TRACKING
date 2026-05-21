@echo off
title TRACKING MM - Kiosk Monitor

:: ---- Leggi configurazione ----
set CFG=%~dp0kiosk.cfg
for /f "tokens=1,2 delims==" %%a in ('findstr /v "^#" "%CFG%"') do (
    if "%%a"=="SERVER_IP"   set SERVER_IP=%%b
    if "%%a"=="SERVER_PORT" set SERVER_PORT=%%b
)
set SERVER_IP=%SERVER_IP: =%
set SERVER_PORT=%SERVER_PORT: =%
set URL=http://%SERVER_IP%:%SERVER_PORT%

:: ---- Trova Chrome ----
set CHROME=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
)
if not defined CHROME (
    echo Chrome non trovato! Installa Google Chrome.
    pause & exit /b 1
)

:: ---- Chiudi eventuali Chrome aperti ----
taskkill /f /im chrome.exe >nul 2>&1
timeout /t 2 >nul

:: ---- Loop: auto-riavvio se Chrome crasha ----
:loop
echo Avvio kiosk: %URL%
start /wait "" "%CHROME%" ^
    --kiosk "%URL%" ^
    --no-first-run ^
    --disable-translate ^
    --disable-infobars ^
    --disable-features=TranslateUI ^
    --disable-session-crashed-bubble ^
    --disable-restore-session-state ^
    --noerrdialogs ^
    --check-for-update-interval=31536000

:: Se Chrome si chiude, aspetta 5 secondi e riapri
echo Chrome chiuso. Riavvio tra 5 secondi...
timeout /t 5 >nul
goto loop
