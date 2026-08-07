param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8001,
    [string]$FrontendHost = "127.0.0.1",
    [int]$FrontendPort = 5174,
    [string]$AppDir = "Script",
    [string]$FrontendDir = "Frontend",
    [string]$ConfigPath = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$launcher = Join-Path $root "Start-RenfrewPlusDev.py"
$argsToPass = @(
    $launcher,
    "--backend-host", $BackendHost,
    "--backend-port", $BackendPort,
    "--frontend-host", $FrontendHost,
    "--frontend-port", $FrontendPort,
    "--app-dir", $AppDir,
    "--frontend-dir", $FrontendDir
)

if ($ConfigPath.Trim()) {
    $argsToPass += @("--config-path", $ConfigPath)
}

python @argsToPass
