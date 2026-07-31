#define MyAppName "Ableton AI Control Bridge"
#define MyAppVersion "0.7.0"
#define MyAppPublisher "Darksco"
#ifndef MyOutputDir
  #define MyOutputDir "..\dist-installer"
#endif

[Setup]
AppId={{B8FF09F8-4A1F-48D4-A1A1-221BF00B86DC}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\Ableton AI Control Bridge
DefaultGroupName={#MyAppName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#MyOutputDir}
OutputBaseFilename=Ableton-AI-Control-Bridge-Setup-v{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\AbletonAIControlBridge.exe
CloseApplications=yes
RestartApplications=no

[Files]
Source: "..\dist\AbletonAIControlBridge\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\max-for-live\AI Control Bridge Receiver.amxd"; DestDir: "{userdocs}\Ableton\User Library\Presets\MIDI Effects\Max MIDI Effect\Ableton AI Control Bridge"; Flags: ignoreversion
Source: "..\max-for-live\AI-Control-Bridge-Receiver.maxpat"; DestDir: "{userdocs}\Ableton\User Library\Presets\MIDI Effects\Max MIDI Effect\Ableton AI Control Bridge"; Flags: ignoreversion
Source: "..\max-for-live\bridge_receiver.js"; DestDir: "{userdocs}\Ableton\User Library\Presets\MIDI Effects\Max MIDI Effect\Ableton AI Control Bridge"; Flags: ignoreversion
Source: "..\remote-scripts\AbletonAIControlBridge\*.py"; DestDir: "{userdocs}\Ableton\User Library\Remote Scripts\AbletonAIControlBridge"; Flags: ignoreversion
Source: "..\examples\*"; DestDir: "{app}\examples"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\docs\*"; DestDir: "{app}\docs"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Ableton AI Control Bridge"; Filename: "{app}\AbletonAIControlBridge.exe"
Name: "{autodesktop}\Ableton AI Control Bridge"; Filename: "{app}\AbletonAIControlBridge.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: checkedonce

[Run]
Filename: "{app}\AbletonAIControlBridge.exe"; Description: "Launch Ableton AI Control Bridge"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
