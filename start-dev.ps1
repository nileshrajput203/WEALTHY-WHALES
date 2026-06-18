# GenAI-Stock Development Server Startup Script
# Reads API keys from .env file (loaded by dotenv/config in server/index.ts)
# This script ONLY sets NODE_ENV — all other keys come from .env

Write-Host "Starting GenAI-Stock Development Server..." -ForegroundColor Green

# Only set NODE_ENV — dotenv/config in server/index.ts handles all other env vars from .env
$env:NODE_ENV = "development"

# Validate critical keys exist in .env
$envFile = Get-Content ".\.env" -ErrorAction SilentlyContinue
if (-not $envFile) {
    Write-Host "ERROR: .env file not found! Create one with your API keys." -ForegroundColor Red
    exit 1
}

$geminiKey = ($envFile | Select-String "GEMINI_API_KEY=").ToString() -replace '.*GEMINI_API_KEY="?([^"]*)"?.*','$1'
if ($geminiKey -match "your_" -or $geminiKey -eq "") {
    Write-Host "WARNING: GEMINI_API_KEY in .env looks like a placeholder. AI features will fail." -ForegroundColor Yellow
    Write-Host "  Get a free key at: https://aistudio.google.com/app/apikey" -ForegroundColor Yellow
} else {
    Write-Host "  GEMINI_API_KEY: Loaded from .env" -ForegroundColor Green
}

Write-Host "  NODE_ENV: $env:NODE_ENV" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting server on http://localhost:5000..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
Write-Host ""

# Start the development server (dotenv/config loads .env automatically)
npx tsx server/index.ts
