# =============================================================
# Pacekeeper — Start All Servers (independent of Antigravity)
# Run this once; all three windows persist even if IDE restarts.
# =============================================================

$ROOT = $PSScriptRoot

Write-Host "Starting Pacekeeper servers in separate windows..." -ForegroundColor Cyan

# 1. Ollama (vision + LLM)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama serve" `
    -WindowStyle Normal

Start-Sleep -Seconds 2

# 2. FastAPI backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$ROOT'; python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload" `
    -WindowStyle Normal

Start-Sleep -Seconds 2

# 3. Vite frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$ROOT\frontend'; npm run dev" `
    -WindowStyle Normal

Write-Host ""
Write-Host "All three servers started in their own windows." -ForegroundColor Green
Write-Host "  Ollama    ->  http://localhost:11434" -ForegroundColor Yellow
Write-Host "  Backend   ->  http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "  Frontend  ->  http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "These windows are INDEPENDENT of Antigravity IDE." -ForegroundColor Cyan
Write-Host "They will NOT stop when Antigravity restarts." -ForegroundColor Cyan
