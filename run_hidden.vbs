Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "d:\PlayGround\Manga"
WshShell.Run chr(34) & "d:\PlayGround\Manga\manga-tracker.exe" & chr(34), 0
Set WshShell = Nothing
