<#
.SYNOPSIS
  CTMS-17-T02 (mobile). Orchestrates integration_test/search_campsites_test.dart
  against the real backend + real Postgres.

.DESCRIPTION
  Unlike apps/web/tests/e2e/search-campsites.spec.ts (Playwright, Node-hosted,
  can shell out to db-helper.ts mid-test), Flutter's integration_test files
  run INSIDE the compiled app itself -- no dart:io there to call db-helper.ts
  from. This script is the host-side counterpart:

    1. Seeds 23 campsites under one unique, throwaway `marker` province via
       db-helper.ts's seed-campsites action (mirrors CTMS-77's Jest fixture
       helper, same as Web's E2E) -- 22 active (20 plain fillers + a
       "Pine Camp" with wifi/toilet + a "Beach Camp" with bbq, both inserted
       LAST so they land deterministically on page 1 of the real backend's
       createdAt DESC ordering) + 1 draft (must never surface).
    2. Creates one throwaway Host account via db-helper.ts's create-account,
       to prove the role-mismatch boundary against a real login.
    3. Records a DB baseline (count-campsites) for this marker.
    4. Runs the actual Flutter E2E (real Chrome, real backend) with the
       marker/host credentials passed in via --dart-define.
    5. Re-checks count-campsites against the baseline -- the invalid-data
       and unauthorized scenarios inside the Flutter run must not have
       mutated the campsites table. This is a whole-run bookend, not a
       per-scenario check like Web's: there is no way to interleave a
       host-side DB call between individual actions while flutter drive
       has control of the process (Decision Gate, approved).
    6. Cleans up every fixture row and the throwaway Host account, in a
       `finally` so a failed run still leaves no test data behind.

.NOTES
  Requires: chromedriver on port 4444, the real backend up
  (docker compose up -d postgres redis; pnpm --filter @ctms/api start:dev),
  and the pre-activated seed account mobiletest@ctms.local / Test@123
  (role Camper) that integration_test/app_test.dart also relies on.

  Run from anywhere:
    pwsh apps/mobile/scripts/run-search-campsites-e2e.ps1
#>

$ErrorActionPreference = 'Stop'

$MobileRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$WorkspaceRoot = Resolve-Path (Join-Path $MobileRoot '..\..')

function Invoke-DbHelper {
    param(
        [Parameter(Mandatory)][string]$Action,
        [Parameter(Mandatory)][string]$Arg
    )
    Push-Location $WorkspaceRoot
    try {
        # No `2>&1` here -- stderr is already captured by this tool/host and
        # merging it would wrap lines as ErrorRecord objects (no .Trim()),
        # breaking the plain-string filtering below even on a clean exit.
        $output = & pnpm --filter '@ctms/api' exec ts-node src/seeds/db-helper.ts $Action $Arg
        if ($LASTEXITCODE -ne 0) {
            throw "db-helper '$Action' failed (exit $LASTEXITCODE):`n$output"
        }
        # db-helper prints exactly one JSON line via console.log; take the
        # last non-blank output line defensively in case pnpm/ts-node ever
        # emit anything else ahead of it.
        $jsonLine = ($output | Where-Object { $_.Trim().Length -gt 0 } | Select-Object -Last 1)
        return $jsonLine | ConvertFrom-Json
    } finally {
        Pop-Location
    }
}

function Invoke-DbHelperJson {
    param(
        [Parameter(Mandatory)][string]$Action,
        [Parameter(Mandatory)]$Payload
    )
    $json = $Payload | ConvertTo-Json -Depth 10 -Compress
    $base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
    return Invoke-DbHelper -Action $Action -Arg $base64
}

# --- 1. Unique, throwaway identifiers -- never collide across runs ----------

$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$randomTag = Get-Random -Maximum 99999
$marker = "CTMS17E2E$timestamp$randomTag"
$hostEmail = "e2e-search-campsites-host-$timestamp-$randomTag@example.com"
$hostPassword = 'S3curePass!'
$hostPhoneTail = ($timestamp % 1000).ToString('000')
$hostPhoneRand = (Get-Random -Maximum 99999).ToString('00000')
$hostPhone = "09$hostPhoneTail$hostPhoneRand"

Write-Host "Marker: $marker"
Write-Host "Host login: $hostEmail"

# --- 2. Build the 23-campsite fixture set ------------------------------------
# Order matters: campsites.repository.ts orders results by createdAt DESC,
# and db-helper.ts inserts sequentially (awaited one at a time), so the LAST
# entries in this array get the newest createdAt -- Pine/Beach are placed
# last so both are guaranteed to land on page 1 (limit=20) regardless of how
# the 20 fillers sort among themselves.

$fillers = @()
for ($i = 1; $i -le 20; $i++) {
    $fillers += @{
        name     = "E2E Filler $($i.ToString('00')) $marker"
        province = $marker
        city     = 'FillerCity'
        status   = 'active'
    }
}

$campsitesPayload = @{
    campsites = @(
        @{
            name     = "E2E Draft Camp $marker"
            province = $marker
            city     = 'Hue'
            status   = 'draft'
        }
    ) + $fillers + @(
        @{
            name   = "E2E Beach Camp $marker"
            province = $marker
            city     = 'Nha Trang'
            status   = 'active'
            zones    = @(@{ amenities = @('bbq'); basePrice = '400.00' })
        },
        @{
            name     = "E2E Pine Camp $marker"
            province = $marker
            city     = 'Da Lat'
            status   = 'active'
            zones    = @(@{ amenities = @('wifi', 'toilet'); basePrice = '150.00' })
            images   = @(@{ url = 'https://example.com/e2e-pine.jpg'; displayOrder = 1 })
        }
    )
}

$seedResult = $null
$hostAccountId = $null
$exitCode = 1

try {
    Write-Host 'Seeding 23 campsites (22 active + 1 draft)...'
    $seedResult = Invoke-DbHelperJson -Action 'seed-campsites' -Payload $campsitesPayload
    $seededHostId = $seedResult.hostId
    $seededCampsiteIds = @($seedResult.campsites | ForEach-Object { $_.id })
    Write-Host "Seeded $($seededCampsiteIds.Count) campsites under fixture host $seededHostId"

    Write-Host 'Creating throwaway Host login account...'
    $hostAccount = Invoke-DbHelperJson -Action 'create-account' -Payload @{
        email    = $hostEmail
        phone    = $hostPhone
        password = $hostPassword
        role     = 'host'
        status   = 'active'
    }
    $hostAccountId = $hostAccount.id

    $countBefore = (Invoke-DbHelper -Action 'count-campsites' -Arg $marker).count
    Write-Host "DB baseline for marker '$marker': $countBefore row(s)"

    # Screenshot evidence -- deliberately OUTSIDE the repo (never committed,
    # purely for pasting into a PR description / manual-testing notes), one
    # timestamped subfolder per run so repeat runs don't overwrite each other.
    $screenshotDir = "D:\CTMS-E2E-Evidence\search-campsites\$timestamp"
    New-Item -ItemType Directory -Force -Path $screenshotDir | Out-Null
    $env:CTMS_E2E_SCREENSHOT_DIR = $screenshotDir
    Write-Host "Screenshots will be saved to: $screenshotDir"

    Write-Host 'Running Flutter E2E (real Chrome, real backend)...'
    Push-Location $MobileRoot
    try {
        & flutter drive `
            --driver=test_driver/integration_test.dart `
            --target=integration_test/search_campsites_test.dart `
            -d chrome `
            "--dart-define=E2E_MARKER=$marker" `
            "--dart-define=E2E_HOST_EMAIL=$hostEmail" `
            "--dart-define=E2E_HOST_PASSWORD=$hostPassword"
        $driveExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    if (Test-Path $screenshotDir) {
        $shots = Get-ChildItem $screenshotDir -Filter '*.png' | Sort-Object Name
        if ($shots.Count -gt 0) {
            Write-Host "Saved $($shots.Count) screenshot(s):"
            $shots | ForEach-Object { Write-Host "  $($_.FullName)" }
        }
    }

    $countAfter = (Invoke-DbHelper -Action 'count-campsites' -Arg $marker).count
    if ($countAfter -ne $countBefore) {
        Write-Host "FAIL -- DB mutation detected under marker '$marker': $countBefore -> $countAfter" -ForegroundColor Red
        $exitCode = 1
    } elseif ($driveExitCode -ne 0) {
        Write-Host "FAIL -- flutter drive exited $driveExitCode" -ForegroundColor Red
        $exitCode = $driveExitCode
    } else {
        Write-Host "PASS -- flutter drive succeeded and DB row count is unchanged ($countAfter)" -ForegroundColor Green
        $exitCode = 0
    }
} finally {
    Write-Host 'Cleaning up fixtures...'
    try {
        if ($seedResult) {
            Invoke-DbHelperJson -Action 'clean-campsites' -Payload @{
                hostIds      = @($seedResult.hostId)
                campsiteIds  = @($seedResult.campsites | ForEach-Object { $_.id })
            } | Out-Null
        }
    } catch {
        Write-Host "Campsite fixture cleanup failed: $_" -ForegroundColor Yellow
    }
    try {
        if ($hostAccountId) {
            Invoke-DbHelper -Action 'clean-user' -Arg $hostEmail | Out-Null
        }
    } catch {
        Write-Host "Host account cleanup failed: $_" -ForegroundColor Yellow
    }
}

exit $exitCode
