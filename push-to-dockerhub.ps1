# Push UltraMuse Dataset Manager to Docker Hub (GPU Version)
# Only GPU version is pushed - CPU is for local testing only

param(
    [string]$DockerUsername = "",
    [string]$ImageName = "ultramuse-dataset-manager",
    [string]$Version = "latest"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Docker Hub Push Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get Docker username if not provided
if ([string]::IsNullOrEmpty($DockerUsername)) {
    $DockerUsername = Read-Host "Enter your Docker Hub username"
}

if ([string]::IsNullOrEmpty($DockerUsername)) {
    Write-Host "❌ Docker Hub username is required!" -ForegroundColor Red
    exit 1
}

$FullImageName = "$DockerUsername/$ImageName"

Write-Host "Docker Hub Image: ${FullImageName}:${Version}" -ForegroundColor Yellow
Write-Host "Build Type: GPU-Enabled (Production)" -ForegroundColor Yellow
Write-Host ""

# Login to Docker Hub
Write-Host "Logging in to Docker Hub..." -ForegroundColor Cyan
docker login

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker login failed!" -ForegroundColor Red
    exit 1
}

# Build GPU version (production)
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building GPU Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

docker build --build-arg ENABLE_GPU=true -t ${FullImageName}:${Version} .

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
    Write-Host "  ✅ Successfully Pushed to Docker Hub!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Image:" -ForegroundColor Cyan
    Write-Host "  ${FullImageName}:${Version}" -ForegroundColor White
    Write-Host ""
    Write-Host "Pull command:" -ForegroundColor Cyan
    Write-Host "  docker pull ${FullImageName}:${Version}" -ForegroundColor White
    Write-Host ""
    Write-Host "Run command:" -ForegroundColor Cyan
    Write-Host "  docker run -d --name dataset-manager ``" -ForegroundColor White
    Write-Host "    --gpus all ``" -ForegroundColor Yellow
    Write-Host "    -p 3000:3000 -p 11435:11435 -p 8675:8675 ``" -ForegroundColor White
    Write-Host "    -v dataset-manager-data:/workspace ``" -ForegroundColor White
    Write-Host "    ${FullImageName}:${Version}" -ForegroundColor White
    Write-Host ""
    Write-Host "Docker Hub URL:" -ForegroundColor Cyan
    Write-Host "  https://hub.docker.com/r/$FullImageName" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host ""
}
