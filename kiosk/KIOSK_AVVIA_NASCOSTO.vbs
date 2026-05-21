Dim WshShell, cartella
Set WshShell = CreateObject("WScript.Shell")
cartella = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
' Avvia kiosk senza finestra terminale visibile
WshShell.Run "cmd /c """ & cartella & "KIOSK_AVVIA.bat""", 0, False
