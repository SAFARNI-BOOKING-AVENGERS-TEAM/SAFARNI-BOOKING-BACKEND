param(
  [string]$FrontendPath = "",
  [string]$WorkspaceRoot = "",
  [string]$OutputRoot = "",
  [switch]$IncludeSecurityScans,
  [switch]$IncludeDocker,
  [switch]$IncludeInfra,
  [switch]$IncludeTerraformPlan
)

$ErrorActionPreference = "Continue"
Set-StrictMode -Version Latest

$BackendPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $WorkspaceRoot) {
  $WorkspaceRoot = Split-Path $BackendPath -Parent
}
if (-not $FrontendPath) {
  $FrontendPath = Join-Path $WorkspaceRoot "SAFARNI-BOOKING-FRONTEND"
}
if (-not $OutputRoot) {
  $OutputRoot = Join-Path $BackendPath "documentation-evidence"
}

$runStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunDir = Join-Path $OutputRoot $runStamp
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null

$results = New-Object System.Collections.Generic.List[object]

function Write-Header {
  param([string]$Path, [string]$Title, [string]$CommandText)
  @(
    "SAFARNI Documentation Evidence",
    "Title: $Title",
    "Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))",
    "Machine: $env:COMPUTERNAME",
    "Command: $CommandText",
    "",
    "--- OUTPUT ---"
  ) | Set-Content -Path $Path -Encoding UTF8
}

function Add-Result {
  param(
    [string]$Name,
    [string]$Status,
    [string]$File,
    [string]$Notes = ""
  )
  $results.Add([PSCustomObject]@{
    Name = $Name
    Status = $Status
    File = $File
    Notes = $Notes
  }) | Out-Null
}

function Test-Tool {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Evidence {
  param(
    [string]$Name,
    [string]$FileName,
    [string]$WorkingDirectory,
    [string]$CommandText,
    [scriptblock]$Action,
    [switch]$NonZeroIsFinding
  )

  $file = Join-Path $RunDir $FileName
  Write-Header -Path $file -Title $Name -CommandText $CommandText
  $start = Get-Date
  $exitCode = 0

  try {
    Push-Location $WorkingDirectory
    & $Action 2>&1 | Tee-Object -FilePath $file -Append | Out-Host
    if ($null -ne $LASTEXITCODE) { $exitCode = $LASTEXITCODE }
  }
  catch {
    $_ | Out-String | Tee-Object -FilePath $file -Append | Out-Host
    $exitCode = 1
  }
  finally {
    Pop-Location
  }

  $duration = [math]::Round(((Get-Date) - $start).TotalSeconds, 2)
  "`n--- RESULT ---`nExitCode: $exitCode`nDurationSeconds: $duration" | Add-Content -Path $file -Encoding UTF8

  if ($exitCode -eq 0) {
    Add-Result -Name $Name -Status "PASS" -File $FileName -Notes "Exit code 0"
  }
  elseif ($NonZeroIsFinding) {
    Add-Result -Name $Name -Status "REVIEW" -File $FileName -Notes "Tool completed with findings / non-zero exit code $exitCode"
  }
  else {
    Add-Result -Name $Name -Status "FAIL" -File $FileName -Notes "Exit code $exitCode"
  }
}

function Add-NotAvailable {
  param([string]$Name, [string]$Reason)
  Add-Result -Name $Name -Status "NOT AVAILABLE" -File "-" -Notes $Reason
}

# 00 - Environment/tool inventory. Intentionally excludes environment-variable values and secret files.
$inventoryFile = Join-Path $RunDir "00-environment-and-tools.txt"
Write-Header -Path $inventoryFile -Title "Environment and Tool Inventory" -CommandText "Local tool/version discovery (no secret values)"
@(
  "BackendPath: $BackendPath",
  "FrontendPath: $FrontendPath",
  "WorkspaceRoot: $WorkspaceRoot",
  "PowerShell: $($PSVersionTable.PSVersion)",
  "Node: $(if (Test-Tool node) { node --version } else { 'NOT INSTALLED' })",
  "npm: $(if (Test-Tool npm) { npm --version } else { 'NOT INSTALLED' })",
  "git: $(if (Test-Tool git) { git --version } else { 'NOT INSTALLED' })",
  "docker: $(if (Test-Tool docker) { docker --version } else { 'NOT INSTALLED' })",
  "gitleaks: $(if (Test-Tool gitleaks) { (gitleaks version 2>&1 | Select-Object -First 1) } else { 'NOT INSTALLED' })",
  "semgrep: $(if (Test-Tool semgrep) { (semgrep --version 2>&1 | Select-Object -First 1) } else { 'NOT INSTALLED' })",
  "trivy: $(if (Test-Tool trivy) { (trivy --version 2>&1 | Select-Object -First 1) } else { 'NOT INSTALLED' })",
  "terraform: $(if (Test-Tool terraform) { terraform version | Select-Object -First 1 } else { 'NOT INSTALLED' })",
  "kubectl: $(if (Test-Tool kubectl) { kubectl version --client 2>&1 | Select-Object -First 1 } else { 'NOT INSTALLED' })"
) | Add-Content -Path $inventoryFile -Encoding UTF8
Add-Result -Name "Environment/tool inventory" -Status "PASS" -File "00-environment-and-tools.txt" -Notes "Inventory only; no secrets captured"

if (-not (Test-Path $FrontendPath)) {
  Add-NotAvailable -Name "Frontend repository" -Reason "Frontend path not found: $FrontendPath"
}

# 01-02 - Git provenance
if (Test-Tool git) {
  Invoke-Evidence -Name "Backend Git provenance" -FileName "01-backend-git.txt" -WorkingDirectory $BackendPath -CommandText "git branch/status/log/remote" -Action {
    git branch --show-current
    git status --short
    git log -1 --date=iso --pretty=format:"commit=%H%nsubject=%s%nauthor=%an%ndate=%ad"
    ""
    git remote -v
  }

  if (Test-Path $FrontendPath) {
    Invoke-Evidence -Name "Frontend Git provenance" -FileName "02-frontend-git.txt" -WorkingDirectory $FrontendPath -CommandText "git branch/status/log/remote" -Action {
      git branch --show-current
      git status --short
      git log -1 --date=iso --pretty=format:"commit=%H%nsubject=%s%nauthor=%an%ndate=%ad"
      ""
      git remote -v
    }
  }
} else {
  Add-NotAvailable -Name "Git provenance" -Reason "git is not installed or not on PATH"
}

# 03-04 - Production builds
if (Test-Tool npm) {
  Invoke-Evidence -Name "Backend TypeScript build" -FileName "03-backend-build.txt" -WorkingDirectory $BackendPath -CommandText "npm run build" -Action { npm run build }
  if (Test-Path $FrontendPath) {
    Invoke-Evidence -Name "Frontend Next.js production build" -FileName "04-frontend-build.txt" -WorkingDirectory $FrontendPath -CommandText "npm run build" -Action { npm run build }
  }
} else {
  Add-NotAvailable -Name "Application builds" -Reason "npm is not installed or not on PATH"
}

# 05-06 - Dependency audit. npm audit returns non-zero when vulnerabilities are found, so mark REVIEW rather than treating the collection itself as broken.
if ($IncludeSecurityScans -and (Test-Tool npm)) {
  Invoke-Evidence -Name "Backend dependency audit" -FileName "05-backend-npm-audit.txt" -WorkingDirectory $BackendPath -CommandText "npm audit --omit=dev" -Action { npm audit --omit=dev } -NonZeroIsFinding
  if (Test-Path $FrontendPath) {
    Invoke-Evidence -Name "Frontend dependency audit" -FileName "06-frontend-npm-audit.txt" -WorkingDirectory $FrontendPath -CommandText "npm audit --omit=dev" -Action { npm audit --omit=dev } -NonZeroIsFinding
  }
} else {
  Add-NotAvailable -Name "Dependency audits" -Reason "Run with -IncludeSecurityScans and ensure npm is installed"
}

# 07-10 - Security scans. No tools are auto-installed; missing tools are reported honestly.
if ($IncludeSecurityScans) {
  if (Test-Tool gitleaks) {
    Invoke-Evidence -Name "Backend Gitleaks scan" -FileName "07-backend-gitleaks.txt" -WorkingDirectory $BackendPath -CommandText "gitleaks detect --source . --no-banner --redact" -Action { gitleaks detect --source . --no-banner --redact } -NonZeroIsFinding
    if (Test-Path $FrontendPath) {
      Invoke-Evidence -Name "Frontend Gitleaks scan" -FileName "08-frontend-gitleaks.txt" -WorkingDirectory $FrontendPath -CommandText "gitleaks detect --source . --no-banner --redact" -Action { gitleaks detect --source . --no-banner --redact } -NonZeroIsFinding
    }
  } else {
    Add-NotAvailable -Name "Gitleaks" -Reason "gitleaks is not installed or not on PATH"
  }

  if (Test-Tool semgrep) {
    Invoke-Evidence -Name "Backend Semgrep scan" -FileName "09-backend-semgrep.txt" -WorkingDirectory $BackendPath -CommandText "semgrep scan --config auto ." -Action { semgrep scan --config auto . } -NonZeroIsFinding
    if (Test-Path $FrontendPath) {
      Invoke-Evidence -Name "Frontend Semgrep scan" -FileName "10-frontend-semgrep.txt" -WorkingDirectory $FrontendPath -CommandText "semgrep scan --config auto ." -Action { semgrep scan --config auto . } -NonZeroIsFinding
    }
  } else {
    Add-NotAvailable -Name "Semgrep" -Reason "semgrep is not installed or not on PATH"
  }

  if (Test-Tool trivy) {
    Invoke-Evidence -Name "Backend Trivy filesystem scan" -FileName "11-backend-trivy-fs.txt" -WorkingDirectory $BackendPath -CommandText "trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL ." -Action { trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL . } -NonZeroIsFinding
    if (Test-Path $FrontendPath) {
      Invoke-Evidence -Name "Frontend Trivy filesystem scan" -FileName "12-frontend-trivy-fs.txt" -WorkingDirectory $FrontendPath -CommandText "trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL ." -Action { trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL . } -NonZeroIsFinding
    }
  } else {
    Add-NotAvailable -Name "Trivy filesystem scans" -Reason "trivy is not installed or not on PATH"
  }
}

# Docker evidence: only builds Dockerfiles located at the actual frontend/backend roots. It does not guess build contexts for arbitrary nested DevOps files.
if ($IncludeDocker) {
  if (-not (Test-Tool docker)) {
    Add-NotAvailable -Name "Docker builds" -Reason "docker is not installed or not on PATH"
  } else {
    $backendDockerfile = Join-Path $BackendPath "Dockerfile"
    if (Test-Path $backendDockerfile) {
      Invoke-Evidence -Name "Backend Docker build" -FileName "13-backend-docker-build.txt" -WorkingDirectory $BackendPath -CommandText "docker build -t safarni-backend:evidence ." -Action { docker build -t safarni-backend:evidence . }
    } else {
      Add-NotAvailable -Name "Backend Docker build" -Reason "No Dockerfile at backend repository root"
    }

    if (Test-Path $FrontendPath) {
      $frontendDockerfile = Join-Path $FrontendPath "Dockerfile"
      if (Test-Path $frontendDockerfile) {
        Invoke-Evidence -Name "Frontend Docker build" -FileName "14-frontend-docker-build.txt" -WorkingDirectory $FrontendPath -CommandText "docker build -t safarni-frontend:evidence ." -Action { docker build -t safarni-frontend:evidence . }
      } else {
        Add-NotAvailable -Name "Frontend Docker build" -Reason "No Dockerfile at frontend repository root"
      }
    }
  }
} else {
  Add-NotAvailable -Name "Docker evidence" -Reason "Run with -IncludeDocker to execute root Dockerfile builds"
}

# Infra discovery: search the workspace, because SAFARNI DevOps files may live outside the application repositories.
$tfDirs = @()
$k8sCandidates = @()
try {
  $tfDirs = Get-ChildItem -Path $WorkspaceRoot -Recurse -File -Filter "*.tf" -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty DirectoryName -Unique
  $k8sCandidates = Get-ChildItem -Path $WorkspaceRoot -Recurse -File -Include "*.yaml","*.yml" -ErrorAction SilentlyContinue |
    Where-Object {
      $text = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
      $text -match '(?m)^kind:\s*(Deployment|Service|Ingress|StatefulSet|ConfigMap|Secret)\s*$'
    } |
    Select-Object -ExpandProperty FullName
} catch {
  # Discovery failures are represented in summary below.
}

$discoveryFile = Join-Path $RunDir "15-infrastructure-discovery.txt"
Write-Header -Path $discoveryFile -Title "Infrastructure File Discovery" -CommandText "Read-only recursive discovery under WorkspaceRoot"
"Terraform directories:" | Add-Content $discoveryFile
if ($tfDirs.Count -gt 0) { $tfDirs | Add-Content $discoveryFile } else { "NONE FOUND" | Add-Content $discoveryFile }
"`nKubernetes-like manifests:" | Add-Content $discoveryFile
if ($k8sCandidates.Count -gt 0) { $k8sCandidates | Add-Content $discoveryFile } else { "NONE FOUND" | Add-Content $discoveryFile }
Add-Result -Name "Infrastructure discovery" -Status "PASS" -File "15-infrastructure-discovery.txt" -Notes "Discovery only; no infrastructure was changed"

if ($IncludeInfra) {
  if ($tfDirs.Count -gt 0) {
    if (Test-Tool terraform) {
      $tfIndex = 0
      foreach ($dir in $tfDirs) {
        $tfIndex++
        Invoke-Evidence -Name "Terraform fmt check #$tfIndex" -FileName ("16-terraform-{0}-fmt.txt" -f $tfIndex) -WorkingDirectory $dir -CommandText "terraform fmt -check -diff" -Action { terraform fmt -check -diff }
        Invoke-Evidence -Name "Terraform init #$tfIndex" -FileName ("17-terraform-{0}-init.txt" -f $tfIndex) -WorkingDirectory $dir -CommandText "terraform init -backend=false -input=false" -Action { terraform init -backend=false -input=false }
        Invoke-Evidence -Name "Terraform validate #$tfIndex" -FileName ("18-terraform-{0}-validate.txt" -f $tfIndex) -WorkingDirectory $dir -CommandText "terraform validate" -Action { terraform validate }
        if ($IncludeTerraformPlan) {
          Invoke-Evidence -Name "Terraform plan #$tfIndex" -FileName ("19-terraform-{0}-plan.txt" -f $tfIndex) -WorkingDirectory $dir -CommandText "terraform plan -input=false -lock=false" -Action { terraform plan -input=false -lock=false }
        }
      }
    } else {
      Add-NotAvailable -Name "Terraform validation" -Reason "Terraform files were found but terraform is not installed/on PATH"
    }
  } else {
    Add-NotAvailable -Name "Terraform validation" -Reason "No .tf files found under WorkspaceRoot"
  }

  if (Test-Tool kubectl) {
    Invoke-Evidence -Name "Kubernetes current context" -FileName "20-kubernetes-context.txt" -WorkingDirectory $WorkspaceRoot -CommandText "kubectl config current-context" -Action { kubectl config current-context }
    Invoke-Evidence -Name "Kubernetes runtime status" -FileName "21-kubernetes-status.txt" -WorkingDirectory $WorkspaceRoot -CommandText "kubectl get deployments,pods,services --all-namespaces" -Action { kubectl get deployments,pods,services --all-namespaces }
  } else {
    Add-NotAvailable -Name "Kubernetes runtime evidence" -Reason "kubectl is not installed or not on PATH"
  }
} else {
  Add-NotAvailable -Name "Terraform/Kubernetes runtime validation" -Reason "Run with -IncludeInfra; Terraform plan additionally requires -IncludeTerraformPlan"
}

# Produce human-readable and machine-readable summaries.
$summaryCsv = Join-Path $RunDir "summary.csv"
$results | Export-Csv -Path $summaryCsv -NoTypeInformation -Encoding UTF8

$summaryMd = Join-Path $RunDir "summary.md"
@(
  "# SAFARNI Documentation Evidence Summary",
  "",
  "Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))",
  "",
  "This pack records actual command results. `NOT AVAILABLE` means the relevant tool/configuration was not present or the optional evidence group was not requested; it must not be documented as a successful validation.",
  "",
  "| Evidence | Status | File | Notes |",
  "|---|---|---|---|"
) | Set-Content -Path $summaryMd -Encoding UTF8

foreach ($r in $results) {
  $safeNotes = ([string]$r.Notes).Replace("|", "\|")
  "| $($r.Name) | $($r.Status) | $($r.File) | $safeNotes |" | Add-Content -Path $summaryMd -Encoding UTF8
}

Write-Host ""
Write-Host "SAFARNI documentation evidence collection complete." -ForegroundColor Green
Write-Host "Evidence folder: $RunDir" -ForegroundColor Cyan
Write-Host "Summary: $summaryMd" -ForegroundColor Cyan
Write-Host ""
$results | Format-Table -AutoSize

# Exit non-zero only if a core application build failed. Security findings are intentionally REVIEW, not runner failures.
$coreBuildFailed = $results | Where-Object { $_.Name -in @("Backend TypeScript build", "Frontend Next.js production build") -and $_.Status -eq "FAIL" }
if ($coreBuildFailed) { exit 1 }
exit 0
