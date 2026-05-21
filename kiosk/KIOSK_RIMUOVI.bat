@echo off
title TRACKING MM - Rimozione Kiosk Monitor
echo.
echo  ============================================
echo   TRACKING MM - Rimozione Kiosk Monitor
echo  ============================================
echo.

:: Verifica privilegi amministratore
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERRORE] Esegui come AMMINISTRATORE!
    echo  Tasto destro -> "Esegui come amministratore"
    pause & exit /b 1
)

set STARTUP_ALL=C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp

echo  [1/4] Chiusura Chrome kiosk in esecuzione...
taskkill /f /im chrome.exe >nul 2>&1
echo       OK

echo.
echo  [2/4] Rimozione avvio automatico...
if exist "%STARTUP_ALL%\TrackingMMKiosk.vbs" (
    del /f /q "%STARTUP_ALL%\TrackingMMKiosk.vbs"
    echo       OK - Rimosso dall'avvio automatico
) else (
    echo       Gia' rimosso
)

echo.
echo  [3/4] Ripristino screensaver (impostazioni predefinite)...
reg add "HKCU\Control Panel\Desktop" /v ScreenSaveActive /t REG_SZ /d "1" /f >nul
reg add "HKCU\Control Panel\Desktop" /v ScreenSaveTimeOut /t REG_SZ /d "600" /f >nul
echo       OK

echo.
echo  [4/4] Ripristino timeout schermo (20 minuti)...
powercfg /change monitor-timeout-ac 20
powercfg /change monitor-timeout-dc 10
powercfg /change standby-timeout-ac 30
powercfg /change standby-timeout-dc 20
echo       OK - Timeout schermo ripristinato

echo.
echo  ============================================
echo   Kiosk rimosso correttamente!
echo.
echo   Chrome non si avviera' piu' automaticamente.
echo   Le impostazioni energetiche sono ripristinate.
echo  ============================================
echo.
pause
