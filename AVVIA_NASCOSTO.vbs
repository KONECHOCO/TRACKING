Dim WshShell, cartella, oExec

Set WshShell = CreateObject("WScript.Shell")
cartella = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

' Avvia il server in background (finestra nascosta)
WshShell.Run "cmd /c """ & cartella & "AVVIA_SERVER.bat""", 0, False

' Aspetta 2 secondi che il server si avvii
WScript.Sleep 2000

' Apre il browser sulla dashboard
WshShell.Run "http://localhost:8080", 1, False
