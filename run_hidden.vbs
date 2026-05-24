Set FSO = CreateObject("Scripting.FileSystemObject")
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = strPath
WshShell.Run chr(34) & strPath & "\manga-tracker.exe" & chr(34), 0
Set WshShell = Nothing
