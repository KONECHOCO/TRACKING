@echo off
title TRACKING MM - Aggiornamento Rapido
echo.
echo  ============================================
echo   TRACKING MM - Aggiornamento file
echo  ============================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERRORE] Esegui come AMMINISTRATORE!
    echo  Tasto destro -> "Esegui come amministratore"
    pause & exit /b 1
)

set SRC=%~dp0
set DST=C:\Program Files (x86)\MMTracking

echo  Copio i file aggiornati...
copy /y "%SRC%main.py"           "%DST%\main.py"           >nul && echo  OK: main.py
copy /y "%SRC%trac2.py"          "%DST%\trac2.py"          >nul && echo  OK: trac2.py
copy /y "%SRC%static\app.js"     "%DST%\static\app.js"     >nul && echo  OK: app.js
copy /y "%SRC%static\index.html" "%DST%\static\index.html" >nul && echo  OK: index.html
copy /y "%SRC%static\style.css"  "%DST%\static\style.css"  >nul && echo  OK: style.css

echo  Aggiorno configurazione siti in ProgramData...
if not exist "C:\ProgramData\MMTracking" mkdir "C:\ProgramData\MMTracking"
copy /y "%SRC%sites.json" "C:\ProgramData\MMTracking\sites.json" >nul && echo  OK: ProgramData\MMTracking\sites.json

echo.
echo  Riavvio il servizio Windows...
net stop TrackingMMOperations >nul 2>&1
timeout /t 2 >nul
net start TrackingMMOperations >nul 2>&1
if %errorLevel% equ 0 (
    echo  OK: Servizio riavviato!
) else (
    echo  NOTA: Servizio non attivo - usa l'icona Avvia sul desktop.
)

echo.
echo  ============================================
echo   Aggiornamento completato!
echo   Ricarica il browser con Ctrl+Shift+R
echo  ============================================
echo.
pause
