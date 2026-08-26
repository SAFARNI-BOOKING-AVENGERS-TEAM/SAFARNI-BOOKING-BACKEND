param(
  [string]$BackendPath = (Resolve-Path (Join-Path $PSScriptRoot "..")),
  [string]$FrontendPath = "D:\safarni test\SAFARNI-BOOKING-FRONTEND"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $BackendPath "documentation-evidence\security-$timestamp"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param([string]$Name,[string]$Status,[string]$File,[string]$Notes)
  $results.Add([pscustomobject]@{ Name=$Name; Status=$Status; File=$File; Notes=$Notes }) | Out-Null
}

function Invoke-Scan {
  param(
    [string]$Name,
    [string]$FileName,
    [scriptblock]$Action
  )

  $file = Join-Path $runDir $FileName
  @(
    "SAFARNI Security Evidence",
    "Title: $Name",
    "Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))",
    "Machine: $env:COMPUTERNAME",
    "",
    "--- OUTPUT ---"
  ) | Set-Content -Path $file -Encoding UTF8

  $start = Get-Date
  $exitCode = 0
  try {
    & $Action 2>&1 | Tee-Object -FilePath $file -Append | Out-Host
    if ($null -ne $LASTEXITCODE) { $exitCode = $LASTEXITCODE }
  }
  catch {
    $_ | Out-String | Tee-Object -FilePath $file -Append | Out-Host
    $exitCode = 1
  }

  $duration = [math]::Round(((Get-Date)-$start).TotalSeconds,2)
  "`n--- RESULT ---`nExitCode: $exitCode`nDurationSeconds: $duration" | Add-Content -Path $file -Encoding UTF8

  if ($exitCode -eq 0) {
    Add-Result -Name $Name -Status "PASS" -File $FileName -Notes "No blocking findings; exit code 0"
  } else {
    Add-Result -Name $Name -Status "REVIEW" -File $FileName -Notes "Scanner completed with findings or error; exit code $exitCode"
  }
}

# Docker must be installed and the Linux engine must be running.
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker engine is not available. Start Docker Desktop and rerun this script."
}

if (-not (Test-Path $FrontendPath)) {
  throw "Frontend path not found: $FrontendPath"
}

Write-Host "Pulling pinned/official security scanner images..." -ForegroundColor Cyan
# v8.30.0 is pinned deliberately; v8.30.1 has a reported secret-detection regression.
docker pull ghcr.io/gitleaks/gitleaks:v8.30.0 | Out-Host
docker pull semgrep/semgrep:latest | Out-Host
docker pull aquasec/trivy:0.74.0 | Out-Host

# Gitleaks scans committed git history. Current filesystem secrets are also covered by Trivy below.
# --redact prevents leaked values from being printed into evidence files.
Invoke-Scan -Name "Backend Gitleaks git-history scan" -FileName "01-backend-gitleaks.txt" -Action {
  docker run --rm -v "${BackendPath}:/repo" ghcr.io/gitleaks/gitleaks:v8.30.0 git /repo --no-banner --redact
}
Invoke-Scan -Name "Frontend Gitleaks git-history scan" -FileName "02-frontend-gitleaks.txt" -Action {
  docker run --rm -v "${FrontendPath}:/repo" ghcr.io/gitleaks/gitleaks:v8.30.0 git /repo --no-banner --redact
}

# Semgrep CE SAST. --error makes findings produce a non-zero exit code so evidence is marked REVIEW instead of false PASS.
Invoke-Scan -Name "Backend Semgrep SAST" -FileName "03-backend-semgrep.txt" -Action {
  docker run --rm -v "${BackendPath}:/src" semgrep/semgrep:latest semgrep scan --config auto --error /src
}
Invoke-Scan -Name "Frontend Semgrep SAST" -FileName "04-frontend-semgrep.txt" -Action {
  docker run --rm -v "${FrontendPath}:/src" semgrep/semgrep:latest semgrep scan --config auto --error /src
}

# Trivy filesystem scan. Exit code 1 is requested for HIGH/CRITICAL findings.
Invoke-Scan -Name "Backend Trivy HIGH/CRITICAL scan" -FileName "05-backend-trivy.txt" -Action {
  docker run --rm -v "${BackendPath}:/repo" aquasec/trivy:0.74.0 fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --exit-code 1 /repo
}
Invoke-Scan -Name "Frontend Trivy HIGH/CRITICAL scan" -FileName "06-frontend-trivy.txt" -Action {
  docker run --rm -v "${FrontendPath}:/repo" aquasec/trivy:0.74.0 fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --exit-code 1 /repo
}

$summaryCsv = Join-Path $runDir "summary.csv"
$results | Export-Csv -Path $summaryCsv -NoTypeInformation -Encoding UTF8

$summaryMd = Join-Path $runDir "summary.md"
@(
  "# SAFARNI Security Evidence Summary",
  "",
  "Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))",
  "",
  "PASS means the scanner returned exit code 0 under the configured policy. REVIEW means findings or a scanner error require inspection; it is not automatically a project failure.",
  "",
  "| Evidence | Status | File | Notes |",
  "|---|---|---|---|"
) | Set-Content -Path $summaryMd -Encoding UTF8
foreach ($r in $results) {
  "| $($r.Name) | $($r.Status) | $($r.File) | $($r.Notes) |" | Add-Content -Path $summaryMd -Encoding UTF8
}

Write-Host ""
Write-Host "SAFARNI security evidence collection complete." -ForegroundColor Green
Write-Host "Evidence folder: $runDir" -ForegroundColor Cyan
Write-Host "Summary: $summaryMd" -ForegroundColor Cyan
Write-Host ""
$results | Format-Table -AutoSize

exit 0
