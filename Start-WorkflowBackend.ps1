param(
    [string]$Host = "0.0.0.0",
    [int]$Port = 8001,
    [string]$AppDir = "Script",
    [string]$ConfigPath = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if ($ConfigPath.Trim()) {
    if ([System.IO.Path]::IsPathRooted($ConfigPath)) {
        $resolvedConfig = [System.IO.Path]::GetFullPath($ConfigPath)
    } else {
        $resolvedConfig = [System.IO.Path]::GetFullPath((Join-Path $root $ConfigPath))
    }
    $env:WORKFLOW_CONFIG_PATH = $resolvedConfig
}

python -m uvicorn api:app --app-dir $AppDir --host $Host --port $Port
