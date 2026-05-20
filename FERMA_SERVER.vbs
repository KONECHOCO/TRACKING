Dim WshShell, oExec, risultato

Set WshShell = CreateObject("WScript.Shell")

' Trova e termina il processo uvicorn/python sulla porta 8080
WshShell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -aon ^| find "":8080"" ^| find ""LISTENING""') do taskkill /f /pid %a", 0, True

' Conferma
risultato = MsgBox("Server TRACKING MM Operations fermato.", vbInformation + vbOKOnly, "TRACKING MM - Server Fermato")
