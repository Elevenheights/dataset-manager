# Build UltraMuse Dataset Manager (CPU-Only Version)
# This version works on any system, including those without GPU

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building CPU-Compatible Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This build works on:" -ForegroundColor Green
Write-Host "  ✓ Systems without GPU" -ForegroundColor Green
Write-Host "  ✓ Docker Desktop on Windows/Mac" -ForegroundColor Green
Write-Host "  ✓ Any Docker environment" -ForegroundColor Green
Write-Host ""
Write-Host "Building..." -ForegroundColor Yellow
Write-Host ""

docker build -t ultramuse-dataset-manager:latest .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ Build Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "To run the container:" -ForegroundColor Cyan
    Write-Host "  docker run -d --name dataset-manager \" -ForegroundColor White
    Write-Host "    -p 3000:3000 -p 11435:11435 -p 8675:8675 \" -ForegroundColor White
    Write-Host "    -v dataset-manager-data:/workspace \" -ForegroundColor White
    Write-Host "    ultramuse-dataset-manager:latest" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host ""
}

