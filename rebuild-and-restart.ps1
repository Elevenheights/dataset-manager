# Quick Rebuild and Restart Script
# Stops, rebuilds, and restarts the container with all latest fixes

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Rebuilding Dataset Manager" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Stop and remove existing container
Write-Host "Stopping existing container..." -ForegroundColor Yellow
docker stop dataset-manager-test 2>$null
docker rm dataset-manager-test 2>$null

# Rebuild
Write-Host "Rebuilding image with latest fixes..." -ForegroundColor Yellow
docker build -t ultramuse-dataset-manager:latest .

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Start container
Write-Host ""
Write-Host "Starting container..." -ForegroundColor Yellow
docker run -d --name dataset-manager-test `
  -p 3000:3000 `
  -p 11435:11435 `
  -p 8675:8675 `
  -v dataset-manager-data:/workspace `
  ultramuse-dataset-manager:latest

# Wait for services to start
Write-Host ""
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check caption service
Write-Host ""
Write-Host "Checking caption service..." -ForegroundColor Yellow
docker exec dataset-manager-test curl -s http://localhost:11435/health | ConvertFrom-Json | Format-List

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ Ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  • Dataset Manager:  http://localhost:3000" -ForegroundColor White
Write-Host "  • Caption Service:  http://localhost:11435" -ForegroundColor White
Write-Host "  • AI Toolkit:       http://localhost:8675" -ForegroundColor White
Write-Host ""
Write-Host "Fixed issues:" -ForegroundColor Cyan
Write-Host "  ✓ Model download progress bars now update" -ForegroundColor Green
Write-Host "  ✓ Caption service checks for both model files" -ForegroundColor Green
Write-Host "  ✓ Cumulative progress across multi-file downloads" -ForegroundColor Green
Write-Host "  ✓ Image path resolution for Windows/Docker" -ForegroundColor Green
Write-Host ""

