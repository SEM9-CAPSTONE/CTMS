param(
    [ValidateSet("all", "unit", "integration", "ui", "checks")]
    [string]$Group = "all",
    [string]$EvidenceDirectory = ""
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($EvidenceDirectory)) {
    $EvidenceDirectory = Join-Path $repositoryRoot "docs/evidence/ctms-138/terminal"
}
$null = New-Item -ItemType Directory -Force -Path $EvidenceDirectory
$summary = [System.Collections.Generic.List[object]]::new()

function Invoke-TaskCheck {
    param([string]$Name, [string]$Directory, [string[]]$NodeArguments)
    $logPath = Join-Path $EvidenceDirectory "$Name.txt"
    Write-Host "`n=== CTMS-138 | $Name ===" -ForegroundColor Cyan
    Push-Location (Join-Path $repositoryRoot $Directory)
    try {
        # Jest writes successful test summaries to stderr too. Judge success by its exit code.
        $previousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & node @NodeArguments 2>&1 | Tee-Object -FilePath $logPath
            $nativeExitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $previousErrorAction
        }
        if ($nativeExitCode -ne 0) {
            throw "$Name failed with exit code $nativeExitCode. See $logPath"
        }
        $summary.Add([pscustomobject]@{ Check = $Name; Result = "PASS"; Log = $logPath })
        Write-Host "PASS: $Name" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

if ($Group -in @("all", "unit")) {
    Invoke-TaskCheck "01-api-unit" "services/api" @(
        "node_modules/jest/bin/jest.js", "--runInBand",
        "porter-level-comparison", "porter-route-qualifications.service.spec", "porter-profiles.service.spec"
    )
}
if ($Group -in @("all", "integration")) {
    $previousTestDatabase = $env:TEST_DATABASE_URL
    try {
        if ([string]::IsNullOrWhiteSpace($env:TEST_DATABASE_URL)) {
            $env:TEST_DATABASE_URL = "postgresql://ctms:ctms@127.0.0.1:5432/ctms_porter_levels_test"
        }
        Invoke-TaskCheck "02-api-integration" "services/api" @(
            "node_modules/jest/bin/jest.js", "--config", "test/jest-integration.json",
            "--runInBand", "--runTestsByPath", "test/porter-profile-qualifications.integration-spec.ts",
            "test/porter-level-requests.integration-spec.ts", "test/porter-levels.integration-spec.ts"
        )
    } finally {
        if ($null -eq $previousTestDatabase) {
            Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
        } else {
            $env:TEST_DATABASE_URL = $previousTestDatabase
        }
    }
}
if ($Group -in @("all", "ui")) {
    Invoke-TaskCheck "03-web-ui" "apps/web" @(
        "node_modules/vitest/vitest.mjs", "run", "src/features/porter-levels",
        "src/features/porter-profile/pages/PorterProfilePage.test.tsx", "src/routes/AppRoutes.porter-profile.test.tsx"
    )
}
if ($Group -in @("all", "checks")) {
    Invoke-TaskCheck "04-api-types" "services/api" @("node_modules/typescript/bin/tsc", "--noEmit")
    Invoke-TaskCheck "05-web-types" "apps/web" @("node_modules/typescript/bin/tsc", "-b")
    Invoke-TaskCheck "06-api-lint" "services/api" @("node_modules/eslint/bin/eslint.js", "src/modules/porter-levels")
    Invoke-TaskCheck "07-web-lint" "apps/web" @("node_modules/eslint/bin/eslint.js", "src/features/porter-levels", "src/core/api/httpClient.ts")
    Invoke-TaskCheck "08-feature-format" "." @(
        "node_modules/@biomejs/biome/bin/biome", "check", "services/api/src/modules/porter-levels",
        "apps/web/src/features/porter-levels", "services/api/src/migrations/1793100000000-CreatePorterLevelReviews.ts",
        "services/api/src/migrations/1793100000001-CreatePorterLevelRequests.ts"
    )
    Invoke-TaskCheck "09-web-build" "apps/web" @("node_modules/vite/bin/vite.js", "build")
}

Write-Host "`n=== CTMS-138 EVIDENCE SUMMARY ===" -ForegroundColor Cyan
$summary | Select-Object Check, Result | Format-Table -AutoSize | Out-String | Tee-Object -FilePath (Join-Path $EvidenceDirectory "summary-$Group.txt") | Write-Host
Write-Host "Evidence logs: $EvidenceDirectory"
Write-Host "No seed command was executed. Integration tests use a separate database ending in _test."
