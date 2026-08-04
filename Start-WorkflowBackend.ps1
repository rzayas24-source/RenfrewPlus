param(
    [string]$Host = "0.0.0.0",
    [int]$Port = 8001,
    [string]$AppDir = "Script",
    [string]$ConfigPath = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$launcher = Join-Path $root "Start-WorkflowBackend.py"
$argsToPass = @(
    $launcher,
    "--host", $Host,
    "--port", $Port,
    "--app-dir", $AppDir
)

if ($ConfigPath.Trim()) {
    $argsToPass += @("--config-path", $ConfigPath)
}

python @argsToPass
