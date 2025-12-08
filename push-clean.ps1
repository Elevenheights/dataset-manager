# Clean build and push to Docker Hub (GPU-enabled, no cache)
# This ensures llama-cpp-python is built with CUDA support

param(
    [string]$DockerUsername = "elevenheights",
    [string]$ImageName = "ultramuse-dataset-manager",
    [string]$Version = "latest"
)

$FullImageName = "$DockerUsername/$ImageName"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Clean Build & Push (GPU-Enabled)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Image: ${FullImageName}:${Version}" -ForegroundColor Yellow
Write-Host "GPU Support: ENABLED (CUDA)" -ForegroundColor Green
Write-Host "Build: NO CACHE (fresh build)" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  This will take 15-25 minutes" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# Login to Docker Hub
Write-Host ""
Write-Host "Logging in to Docker Hub..." -ForegroundColor Cyan
docker login

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker login failed!" -ForegroundColor Red
    exit 1
}

# Clean build with GPU support
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building (No Cache)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

docker build --no-cache --build-arg ENABLE_GPU=true -t ${FullImageName}:${Version} .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Push to Docker Hub
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pushing to Docker Hub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

docker push ${FullImageName}:${Version}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ Successfully Pushed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Image: ${FullImageName}:${Version}" -ForegroundColor White
    Write-Host ""
    Write-Host "GPU Support: ✅ CUDA Enabled" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pull command:" -ForegroundColor Cyan
    Write-Host "  docker pull ${FullImageName}:${Version}" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  On RunPod, restart your pod to pull the new image" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host ""
}

