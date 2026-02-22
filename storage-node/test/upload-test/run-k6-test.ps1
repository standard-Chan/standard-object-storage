#!/usr/bin/env pwsh

<#
.SYNOPSIS
    k6 부하 테스트 실행 스크립트
    
.DESCRIPTION
    다양한 부하 테스트 시나리오를 쉽게 실행할 수 있는 PowerShell 스크립트
    
.PARAMETER Scenario
    실행할 테스트 시나리오 (light, medium, heavy, stress, custom)
    
.PARAMETER VUs
    동시 가상 사용자 수 (custom 시나리오에서 사용)
    
.PARAMETER Duration
    테스트 지속 시간 (custom 시나리오에서 사용)
    
.PARAMETER Bucket
    사용할 버킷 이름 (기본값: bucket1)
    
.EXAMPLE
    .\run-k6-test.ps1 -Scenario light
    .\run-k6-test.ps1 -Scenario heavy
    .\run-k6-test.ps1 -Scenario custom -VUs 100 -Duration 5m
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('light', 'medium', 'heavy', 'stress', 'custom')]
    [string]$Scenario,
    
    [Parameter(Mandatory=$false)]
    [int]$VUs = 10,
    
    [Parameter(Mandatory=$false)]
    [string]$Duration = "30s",
    
    [Parameter(Mandatory=$false)]
    [string]$Bucket = "bucket1",
    
    [Parameter(Mandatory=$false)]
    [string]$ControlPlaneUrl = "http://localhost:8080"
)

# 스크립트 디렉토리로 이동
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# k6 설치 확인
Write-Host "🔍 k6 설치 확인 중..." -ForegroundColor Cyan
$k6Version = k6 version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ k6가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "설치 방법:" -ForegroundColor Yellow
    Write-Host "  winget install k6" -ForegroundColor White
    Write-Host "  또는" -ForegroundColor White
    Write-Host "  choco install k6" -ForegroundColor White
    exit 1
}
Write-Host "✅ k6 버전: $k6Version" -ForegroundColor Green

# 서버 상태 확인
Write-Host ""
Write-Host "🔍 서버 상태 확인 중..." -ForegroundColor Cyan

try {
    $controlPlaneResponse = Invoke-WebRequest -Uri "$ControlPlaneUrl/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Control Plane: 정상 (HTTP $($controlPlaneResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Control Plane: 응답 없음 ($ControlPlaneUrl)" -ForegroundColor Yellow
    Write-Host "   계속하려면 Enter를 누르세요..." -ForegroundColor Gray
    Read-Host
}

# 시나리오별 설정
Write-Host ""
Write-Host "📋 테스트 시나리오: $Scenario" -ForegroundColor Cyan

switch ($Scenario) {
    'light' {
        $VUs = 10
        $Duration = "1m"
        $Description = "가벼운 부하 (10명, 1분)"
    }
    'medium' {
        $VUs = 50
        $Duration = "2m"
        $Description = "중간 부하 (50명, 2분)"
    }
    'heavy' {
        $VUs = 100
        $Duration = "3m"
        $Description = "높은 부하 (100명, 3분)"
    }
    'stress' {
        $VUs = 200
        $Duration = "5m"
        $Description = "스트레스 테스트 (200명, 5분)"
    }
    'custom' {
        $Description = "사용자 정의 ($VUs명, $Duration)"
    }
}

# 테스트 정보 출력
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  🚀 k6 부하 테스트" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "시나리오:        $Description" -ForegroundColor White
Write-Host "가상 사용자 수:  $VUs" -ForegroundColor White
Write-Host "지속 시간:       $Duration" -ForegroundColor White
Write-Host "버킷:            $Bucket" -ForegroundColor White
Write-Host "Control Plane:   $ControlPlaneUrl" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# 결과 디렉토리 생성
$ResultsDir = Join-Path $ScriptDir "test-results"
if (-not (Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir | Out-Null
}

# 결과 파일명
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ResultFile = Join-Path $ResultsDir "k6-result-$Scenario-$Timestamp.json"

# k6 실행
Write-Host "▶️  테스트 시작..." -ForegroundColor Green
Write-Host ""

$k6Args = @(
    "run",
    "--vus", $VUs,
    "--duration", $Duration,
    "--env", "BUCKET=$Bucket",
    "--env", "CONTROL_PLANE_URL=$ControlPlaneUrl",
    "--out", "json=$ResultFile",
    "k6-load-test.js"
)

& k6 $k6Args

# 결과 확인
Write-Host ""
if ($LASTEXITCODE -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ 테스트 완료!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "결과 파일: $ResultFile" -ForegroundColor Cyan
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ❌ 테스트 실패 (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
}

Write-Host ""
Write-Host "다른 시나리오를 실행하려면:" -ForegroundColor Yellow
Write-Host "  .\run-k6-test.ps1 -Scenario light" -ForegroundColor White
Write-Host "  .\run-k6-test.ps1 -Scenario medium" -ForegroundColor White
Write-Host "  .\run-k6-test.ps1 -Scenario heavy" -ForegroundColor White
Write-Host "  .\run-k6-test.ps1 -Scenario stress" -ForegroundColor White
Write-Host "  .\run-k6-test.ps1 -Scenario custom -VUs 150 -Duration 10m" -ForegroundColor White
Write-Host ""
