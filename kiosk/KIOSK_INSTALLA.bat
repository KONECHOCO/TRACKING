@echo off
title TRACKING MM - Installazione Kiosk Monitor
echo.
echo  ============================================
echo   TRACKING MM - Setup Kiosk Monitor
echo  ============================================
echo.

:: Verifica privilegi amministratore
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERRORE] Esegui come AMMINISTRATORE!
    echo  Tasto destro -> "Esegui come amministratore"
    pause & exit /b 1
)

set KIOSK_DIR=%~dp0
set STARTUP_ALL=C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp
set VBS_FILE=%KIOSK_DIR%KIOSK_AVVIA_NASCOSTO.vbs

echo  [1/4] Copia collegamento nella cartella Avvio automatico...
copy /y "%VBS_FILE%" "%STARTUP_ALL%\TrackingMMKiosk.vbs" >nul
echo       OK - Si avviera' automaticamente ad ogni avvio di Windows

echo.
echo  [2/4] Disabilita screensaver...
reg add "HKCU\Control Panel\Desktop" /v ScreenSaveActive /t REG_SZ /d "0" /f >nul
reg add "HKCU\Control Panel\Desktop" /v ScreenSaveTimeOut /t REG_SZ /d "0" /f >nul
echo       OK

echo.
echo  [3/4] Disabilita sospensione e spegnimento schermo...
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
echo       OK - Lo schermo non si spegnera' mai

echo.
echo  [4/4] Avvio kiosk adesso...
start "" wscript.exe "%VBS_FILE%"

echo.
echo  ============================================
echo   Installazione completata!
echo.
echo   - Chrome si apre in fullscreen automaticamente
echo   - Si riavvia da solo se crasha
echo   - Parte automaticamente ad ogni accensione
echo.
echo   Per modificare l'IP del server:
echo   Apri kiosk.cfg con il Blocco Note
echo  ============================================
echo.
pause
