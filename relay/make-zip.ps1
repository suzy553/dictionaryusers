$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (Test-Path -LiteralPath 'relay.zip') {
  Remove-Item -LiteralPath 'relay.zip' -Force
}

Compress-Archive -Path 'sign.js', 'package.json' -DestinationPath 'relay.zip' -Force

$zip = Join-Path $PSScriptRoot 'relay.zip'
Write-Host ''
Write-Host ('relay.zip created: ' + $zip) -ForegroundColor Green
Write-Host 'Upload it to Tencent SCF (handler: sign.main_handler)'
