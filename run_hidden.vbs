Set FSO = CreateObject("Scripting.FileSystemObject")
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = strPath

' Check if /silent argument is passed to avoid popup on Windows Startup
Dim isSilent
isSilent = False
If WScript.Arguments.Count > 0 Then
    If UCase(WScript.Arguments(0)) = "/SILENT" Then
        isSilent = True
    End If
End If

' Setup Auto Startup Shortcut in user's Startup folder
On Error Resume Next
strStartup = WshShell.SpecialFolders("Startup")
Set oShellLink = WshShell.CreateShortcut(strStartup & "\MangaTracker.lnk")
oShellLink.TargetPath = WScript.Path & "\wscript.exe"
oShellLink.Arguments = chr(34) & WScript.ScriptFullName & chr(34) & " /silent"
oShellLink.WorkingDirectory = strPath
oShellLink.WindowStyle = 1
oShellLink.Description = "Start Manga Tracker on Windows Startup"
oShellLink.Save
On Error GoTo 0

' Run the manga-tracker.exe in hidden mode
WshShell.Run chr(34) & strPath & "\manga-tracker.exe" & chr(34), 0

' Show success message only if run manually (without /silent flag)
If Not isSilent Then
    MsgBox "Manga Tracker has been registered to Windows Startup and started successfully in the background!", 64, "Manga Tracker Setup"
End If

Set WshShell = Nothing
Set FSO = Nothing

