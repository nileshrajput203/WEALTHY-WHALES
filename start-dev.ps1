# GenAI-Stock Development Server Startup Script
# This script sets up all required environment variables and starts the development server

Write-Host "Starting GenAI-Stock Development Server..." -ForegroundColor Green

# Set required environment variables
$env:DATABASE_URL = "your_postgres_url"
$env:SESSION_SECRET = "your_session_secret"
$env:GEMINI_API_KEY = "your_gemini_api_key"
$env:GOOGLE_CLIENT_ID = "your_google_client_id"
$env:GOOGLE_CLIENT_SECRET = "your_google_client_secret"
# Optional API keys for enhanced data (free tiers available)
$env:ALPHA_VANTAGE_API_KEY = "your_alpha_vantage_key"
$env:IEX_CLOUD_API_KEY = "your_iex_cloud_key"
$env:FMP_API_KEY = "your_fmp_api_key"
$env:FINNHUB_API_KEY = "your_finnhub_key"
$env:NODE_ENV = "development"

Write-Host "Environment variables set:" -ForegroundColor Yellow
Write-Host "  DATABASE_URL: $env:DATABASE_URL"
Write-Host "  GOOGLE_CLIENT_ID: $env:GOOGLE_CLIENT_ID"
Write-Host "  NODE_ENV: $env:NODE_ENV"
Write-Host ""

Write-Host "Starting server on http://localhost:5000..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
Write-Host ""

# Start the development server
npx tsx server/index.ts
