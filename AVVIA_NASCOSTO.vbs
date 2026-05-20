Dim WshShell, cartella
Set WshShell = CreateObject("WScript.Shell")
cartella = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
' Avvia il server completamente nascosto (nessuna finestra)
WshShell.Run "cmd /c """ & cartella & "AVVIA_SERVER.bat""", 0, False
