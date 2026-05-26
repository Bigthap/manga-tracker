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

' Unblock manga-tracker.exe (removes "downloaded from internet" flag that triggers SmartScreen)
strExePath = strPath & "\manga-tracker.exe"
WshShell.Run "powershell -Command ""Unblock-File -Path '" & strExePath & "'"" ", 0, True

' Run the manga-tracker.exe in hidden mode
On Error Resume Next
WshShell.Run chr(34) & strExePath & chr(34), 0
If Err.Number <> 0 Then
    MsgBox "Failed to start Manga Tracker." & vbCrLf & vbCrLf & _
           "This is usually caused by Windows SmartScreen blocking the file." & vbCrLf & _
           "Try: Right-click manga-tracker.exe > Properties > check 'Unblock' > OK" & vbCrLf & vbCrLf & _
           "Error: " & Err.Description, 16, "Manga Tracker"
    WScript.Quit 1
End If
On Error GoTo 0

' Show success message only if run manually (without /silent flag)
If Not isSilent Then
    MsgBox "Manga Tracker has been registered to Windows Startup and started successfully in the background!", 64, "Manga Tracker Setup"
End If

Set WshShell = Nothing
Set FSO = Nothing

