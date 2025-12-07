# Build UltraMuse Dataset Manager (GPU-Enabled Version)
# This version requires NVIDIA GPU and nvidia-docker runtime

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building GPU-Enabled Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Requirements:" -ForegroundColor Yellow
Write-Host "  • NVIDIA GPU" -ForegroundColor White
Write-Host "  • NVIDIA Docker Runtime" -ForegroundColor White
Write-Host "  • Must run with --gpus all flag" -ForegroundColor White
Write-Host ""
Write-Host "Building with CUDA support..." -ForegroundColor Yellow
Write-Host ""

docker build --build-arg ENABLE_GPU=true -t ultramuse-dataset-manager:gpu .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ GPU Build Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "To run the container with GPU:" -ForegroundColor Cyan
    Write-Host "  docker run -d --name dataset-manager \" -ForegroundColor White
    Write-Host "    --gpus all \" -ForegroundColor Yellow
    Write-Host "    -p 3000:3000 -p 11435:11435 -p 8675:8675 \" -ForegroundColor White
    Write-Host "    -v dataset-manager-data:/workspace \" -ForegroundColor White
    Write-Host "    ultramuse-dataset-manager:gpu" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: The --gpus all flag is REQUIRED for GPU acceleration!" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host ""
}

