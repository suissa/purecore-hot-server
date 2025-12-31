$ignitePath = "$env:USERPROFILE\.purecore\ignite"
$binPath = "$env:USERPROFILE\.purecore\bin"

Write-Host "Installing PureCore Ignite..."

New-Item -ItemType Directory -Force -Path $ignitePath | Out-Null
New-Item -ItemType Directory -Force -Path $binPath | Out-Null

Copy-Item .\ignite.exe "$ignitePath\ignite.exe" -Force

$target = "$binPath\ignite.exe"
$source = "$ignitePath\ignite.exe"

cmd /c mklink $target $source | Out-Null

$envPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($envPath -notlike "*$binPath*") {
  [Environment]::SetEnvironmentVariable(
    "Path",
    "$envPath;$binPath",
    "User"
  )
}

Write-Host "Ignite installed successfully."
Write-Host "Restart your terminal and run: ignite"
