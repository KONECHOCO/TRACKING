#define MyAppName "TRACKING MM Operations"
#define MyAppVersion "1.0"
#define MyAppPublisher "MM Operations"
#define MyAppURL "https://mmoperations.it"
#define MyAppExeName "AVVIA_SERVER.bat"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\MMTracking
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=.\dist
OutputBaseFilename=TRACKING_MM_Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupIconFile=mm_icon.ico
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\mm_icon.ico

[Languages]
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"

[Tasks]
Name: "desktopicon"; Description: "Crea icona sul Desktop"; GroupDescription: "Icone aggiuntive:"

[Files]
Source: "main.py";           DestDir: "{app}"; Flags: ignoreversion
Source: "trac2.py";          DestDir: "{app}"; Flags: ignoreversion
Source: "requirements.txt";  DestDir: "{app}"; Flags: ignoreversion
Source: "AVVIA_SERVER.bat";  DestDir: "{app}"; Flags: ignoreversion
Source: "static\*";          DestDir: "{app}\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "AVVIA_NASCOSTO.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "FERMA_SERVER.vbs";  DestDir: "{app}"; Flags: ignoreversion
Source: "mm_icon.ico";           DestDir: "{app}"; Flags: ignoreversion
Source: "nssm.exe";             DestDir: "{app}"; Flags: ignoreversion
Source: "sites.json";           DestDir: "{app}"; Flags: ignoreversion
Source: "INSTALLA_SERVIZIO.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "RIMUOVI_SERVIZIO.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\▶ Avvia TRACKING MM";       Filename: "{sys}\wscript.exe"; Parameters: """{app}\AVVIA_NASCOSTO.vbs"""; IconFilename: "{app}\mm_icon.ico"
Name: "{group}\■ Ferma TRACKING MM";       Filename: "{sys}\wscript.exe"; Parameters: """{app}\FERMA_SERVER.vbs"""; IconFilename: "{app}\mm_icon.ico"
Name: "{group}\⚙ Installa come Servizio"; Filename: "{app}\INSTALLA_SERVIZIO.bat"; IconFilename: "{app}\mm_icon.ico"
Name: "{group}\Disinstalla";              Filename: "{uninstallexe}"
Name: "{commondesktop}\▶ TRACKING MM"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\AVVIA_NASCOSTO.vbs"""; IconFilename: "{app}\mm_icon.ico"; Tasks: desktopicon
Name: "{commondesktop}\■ Ferma TRACKING MM"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\FERMA_SERVER.vbs"""; IconFilename: "{app}\mm_icon.ico"; Tasks: desktopicon

[Run]
Filename: "{cmd}"; Parameters: "/C pip install -r ""{app}\requirements.txt"""; \
    WorkingDir: "{app}"; \
    StatusMsg: "Installazione dipendenze Python in corso..."; \
    Flags: runhidden waituntilterminated

Filename: "{sys}\wscript.exe"; Parameters: """{app}\AVVIA_NASCOSTO.vbs"""; \
    Description: "Avvia TRACKING MM Operations adesso"; \
    Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Messages]
WelcomeLabel1=Benvenuto nell'installazione di TRACKING MM Operations
WelcomeLabel2=Questo programma installer%n%nTRACKING MM Operations v{#MyAppVersion}%n%nDashboard di monitoraggio spedizioni in tempo reale.%n%nSi raccomanda di chiudere tutte le applicazioni prima di continuare.
