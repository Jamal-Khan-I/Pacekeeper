# Stop script for Pacekeeper servers
$p8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
$p5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($p8000) { Stop-Process -Id $p8000 -Force -ErrorAction SilentlyContinue }
if ($p5173) { Stop-Process -Id $p5173 -Force -ErrorAction SilentlyContinue }

Write-Host "Pacekeeper servers stopped cleanly."
