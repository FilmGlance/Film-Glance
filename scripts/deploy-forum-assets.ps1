# scripts/deploy-forum-assets.ps1
#
# One-shot sync of forum branding assets from this repo to the VPS.
# The brand JS lives at /var/www/html/filmglance-brand.js on the VPS and is
# loaded into every NodeBB page via Nginx sub_filter injection. There is no
# CI auto-deploy — this script is the canonical way to ship changes.
#
# Usage (PowerShell):
#   .\scripts\deploy-forum-assets.ps1
#
# What it does:
#   1. scp filmglance-brand.js from the repo root to /tmp/ on the VPS
#   2. sudo cp it into /var/www/html/ (root-owned, chmod 644)
#   3. Save a timestamped .bak of the previous version on the VPS
#   4. Print before/after MD5 + byte size for verification
#
# Safety:
#   - Pure file copy. Doesn't restart NodeBB, Nginx, or anything.
#   - The previous version is preserved as filmglance-brand.js.bak-YYYYMMDD-HHMMSS
#     on the VPS — restore with a single `cp` if anything goes wrong.

$ErrorActionPreference = "Stop"

$VPS_USER = "filmglance"
$VPS_HOST = "147.93.113.39"
$REPO_ROOT = Split-Path -Parent $PSScriptRoot
$LOCAL_FILE = Join-Path $REPO_ROOT "filmglance-brand.js"

if (-not (Test-Path $LOCAL_FILE)) {
    Write-Host "ERROR: $LOCAL_FILE not found" -ForegroundColor Red
    exit 1
}

$localHash = (Get-FileHash -Algorithm MD5 $LOCAL_FILE).Hash.ToLower()
$localSize = (Get-Item $LOCAL_FILE).Length
Write-Host "Local file: $LOCAL_FILE"
Write-Host "  size : $localSize bytes"
Write-Host "  md5  : $localHash"
Write-Host ""

Write-Host "Uploading to ${VPS_HOST}:/tmp/..."
scp $LOCAL_FILE "${VPS_USER}@${VPS_HOST}:/tmp/filmglance-brand.js.new"
if ($LASTEXITCODE -ne 0) {
    Write-Host "scp failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Installing on VPS (sudo cp + chmod)..."
$remoteCmd = @'
set -e
echo "Old hash on VPS:"
sudo -n md5sum /var/www/html/filmglance-brand.js
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
sudo -n cp /var/www/html/filmglance-brand.js /var/www/html/filmglance-brand.js.bak-$TIMESTAMP
sudo -n cp /tmp/filmglance-brand.js.new /var/www/html/filmglance-brand.js
sudo -n chown root:root /var/www/html/filmglance-brand.js
sudo -n chmod 644 /var/www/html/filmglance-brand.js
rm -f /tmp/filmglance-brand.js.new
echo "New hash on VPS:"
sudo -n md5sum /var/www/html/filmglance-brand.js
echo "Backup saved at: /var/www/html/filmglance-brand.js.bak-$TIMESTAMP"
'@

ssh "${VPS_USER}@${VPS_HOST}" $remoteCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "remote install failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Done. Hard-refresh the forum (Ctrl+Shift+R) to see changes." -ForegroundColor Green
Write-Host "If something breaks, SSH in and run:" -ForegroundColor Yellow
Write-Host "  sudo cp /var/www/html/filmglance-brand.js.bak-<timestamp> /var/www/html/filmglance-brand.js" -ForegroundColor Yellow
