param(
    [string]$FrontendDir = "Frontend"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

python build.py --frontend-dir $FrontendDir
