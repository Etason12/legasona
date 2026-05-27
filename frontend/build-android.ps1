param(
    [switch]$LiveUrl,
    [string]$ApiUrl = ""
)

if ($LiveUrl) {
    Write-Host "Building with live server URL from Render..." -ForegroundColor Cyan
    $env:VITE_API_URL = "https://legasonaimporter.onrender.com/api"
} elseif ($ApiUrl) {
    Write-Host "Building with custom API URL: $ApiUrl" -ForegroundColor Cyan
    $env:VITE_API_URL = $ApiUrl
} else {
    Write-Host "Building with default API URL (render)..." -ForegroundColor Cyan
    $env:VITE_API_URL = "https://legasonaimporter.onrender.com/api"
}

Write-Host "VITE_API_URL=$env:VITE_API_URL" -ForegroundColor Yellow

# Build the frontend
npm run build
if (-not $?) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Sync with Capacitor
npx cap sync
if (-not $?) {
    Write-Host "Capacitor sync failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nBuild complete! Opening Android Studio..." -ForegroundColor Green
npx cap open android
