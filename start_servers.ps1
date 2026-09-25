# Detached Server Launcher for Pacekeeper (Windows PowerShell)
$projectRoot = $PSScriptRoot
$pythonExe = "C:\Users\ASUS\AppData\Local\Programs\Python\Python314\python.exe"

# Kill any existing processes on 8000 / 5173
$p8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
$p5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($p8000) { Stop-Process -Id $p8000 -Force -ErrorAction SilentlyContinue }
if ($p5173) { Stop-Process -Id $p5173 -Force -ErrorAction SilentlyContinue }

Write-Host "Launching Backend on http://127.0.0.1:8000..."
Start-Process -FilePath $pythonExe -ArgumentList "-m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000" -WorkingDirectory $projectRoot -WindowStyle Hidden

Write-Host "Launching Frontend on http://localhost:5173..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory "$projectRoot\frontend" -WindowStyle Hidden

Start-Sleep -Seconds 3
Write-Host "Pacekeeper Backend & Frontend launched successfully in detached background mode!"
