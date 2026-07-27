param(
    [string]$FrontendDir = "Frontend",
    [string[]]$PopplerSourceCandidates = @(
        "tools\poppler",
        "third_party\poppler",
        "vendor\poppler"
    )
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Building frontend..."
Push-Location (Join-Path $root $FrontendDir)
try {
    npm run build
}
finally {
    Pop-Location
}

$destination = Join-Path $root "poppler"
$source = $null
$requiredPopplerFiles = @(
    "Library\bin\pdfinfo.exe",
    "Library\bin\pdftoppm.exe"
)

foreach ($candidate in $PopplerSourceCandidates) {
    $resolved = Join-Path $root $candidate
    if (Test-Path -LiteralPath $resolved) {
        $source = $resolved
        break
    }
}

if ($null -eq $source) {
    throw "Poppler is not bundled. Add it under one of these folders: $($PopplerSourceCandidates -join ', ')"
}

foreach ($requiredFile in $requiredPopplerFiles) {
    $requiredPath = Join-Path $source $requiredFile
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Poppler bundle is incomplete. Missing required file: $requiredPath"
    }
}

if (Test-Path -LiteralPath $destination) {
    Remove-Item -LiteralPath $destination -Recurse -Force
}

Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
Write-Host "Copied bundled Poppler from $source to $destination"
