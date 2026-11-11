<#
.SYNOPSIS
  CTMS-02 [Mobile]. Orchestrates integration_test/verify_otp_test.dart
  against the real backend + real Postgres.

.DESCRIPTION
  Tests 1-2 in that file are self-contained (they register their own
  fresh account via the real UI, same as integration_test/app_test.dart) --
  this script exists only for Test 3, which needs a `pending_verification`
  account plus a KNOWN OTP value already sitting in Postgres before
  `flutter drive` starts, since `integration_test/*.dart` runs inside the
  compiled app and has no `dart:io` to call db-helper.ts mid-test (see that
  file's own header comment for why a real send-otp call and a known code
  can never coexist within one running test).

  Steps:
    1. Create a throwaway `pending_verification` Camper account directly
       via db-helper.ts's create-account (no UI involved for this one --
       there is no register-flow navigation to ride along with).
    2. Plant a known OTP for it via db-helper.ts's get-otp (this action
       always overwrites `verification_otps` unconditionally, so it works
       whether or not any send-otp call ever happened for this account).
    3. Run the actual Flutter E2E (real Chrome/backend/Postgres) with the
       email/phone/userId/otp passed in via --dart-define.
    4. Clean up: the Test-3 account, plus Tests 1-2's own dynamically
       generated `e2e-verify-{send,wrong}-*@example.com` accounts (found
       by pattern after the run, since this script can't know their exact
       timestamps in advance).

.NOTES
  Requires: chromedriver on port 4444, the real backend up
  (docker compose up -d postgres redis; pnpm --filter @ctms/api start:dev).

  Run from anywhere:
    pwsh apps/mobile/scripts/run-verify-otp-e2e.ps1
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
        # No `2>&1` -- stderr is already captured by this tool/host and
        # merging it would wrap lines as ErrorRecord objects (no .Trim()).
        $output = & pnpm --filter '@ctms/api' exec ts-node src/seeds/db-helper.ts $Action $Arg
        if ($LASTEXITCODE -ne 0) {
            throw "db-helper '$Action' failed (exit $LASTEXITCODE):`n$output"
        }
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

# --- 1. Unique, throwaway identifiers for Test 3's account ------------------

$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$randomTag = Get-Random -Maximum 99999
$email = "e2e-verify-known-$timestamp-$randomTag@example.com"
$phoneTail = ($timestamp % 1000).ToString('000')
$phoneRand = (Get-Random -Maximum 99999).ToString('00000')
$phone = "09$phoneTail$phoneRand"

Write-Host "Test 3 account: $email"

$exitCode = 1

try {
    Write-Host 'Creating throwaway pending_verification account...'
    $account = Invoke-DbHelperJson -Action 'create-account' -Payload @{
        email    = $email
        phone    = $phone
        password = 'E2eTest@123'
        role     = 'camper'
        status   = 'pending_verification'
    }
    $userId = $account.id
    Write-Host "Account id: $userId"

    Write-Host 'Planting a known OTP...'
    $otpResult = Invoke-DbHelper -Action 'get-otp' -Arg $email
    $otp = $otpResult.otp
    Write-Host "Planted OTP: $otp"

    Write-Host 'Running Flutter E2E (real Chrome, real backend)...'
    Push-Location $MobileRoot
    try {
        & flutter drive `
            --driver=test_driver/integration_test.dart `
            --target=integration_test/verify_otp_test.dart `
            -d chrome `
            "--dart-define=E2E_EMAIL=$email" `
            "--dart-define=E2E_PHONE=$phone" `
            "--dart-define=E2E_USER_ID=$userId" `
            "--dart-define=E2E_OTP=$otp"
        $driveExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    if ($driveExitCode -ne 0) {
        Write-Host "FAIL -- flutter drive exited $driveExitCode" -ForegroundColor Red
        $exitCode = $driveExitCode
    } else {
        # Bonus rigor: confirm Test 3 actually flipped the account server-side,
        # not just that the UI showed a success message.
        $afterUser = Invoke-DbHelper -Action 'get-user' -Arg $email
        if ($afterUser.user.status -eq 'active') {
            Write-Host "PASS -- flutter drive succeeded and account status is 'active' in Postgres" -ForegroundColor Green
            $exitCode = 0
        } else {
            Write-Host "FAIL -- account status is '$($afterUser.user.status)', expected 'active'" -ForegroundColor Red
            $exitCode = 1
        }
    }
} finally {
    Write-Host 'Cleaning up...'
    try {
        Invoke-DbHelper -Action 'clean-user' -Arg $email | Out-Null
    } catch {
        Write-Host "Test-3 account cleanup failed: $_" -ForegroundColor Yellow
    }

    # Tests 1-2 register their own account via the real UI with a timestamp
    # this script can't predict in advance -- find them by their fixed tag
    # prefix instead, via db-helper.ts's find-users-by-email-prefix action
    # (NOT a throwaway file written under services/api/src/ -- that
    # directory is watched by the running `nest start --watch` backend, so
    # creating/deleting a file there on every run triggered a real
    # recompile+restart each time, which could then race a still-in-flight
    # request from the very next run and cause exactly the intermittent
    # failures this action exists to avoid).
    try {
        foreach ($prefix in @('e2e-verify-send-', 'e2e-verify-wrong-')) {
            $strayEmails = Invoke-DbHelper -Action 'find-users-by-email-prefix' -Arg $prefix
            foreach ($strayEmail in $strayEmails) {
                Invoke-DbHelper -Action 'clean-user' -Arg $strayEmail | Out-Null
                Write-Host "Cleaned up $strayEmail"
            }
        }
    } catch {
        Write-Host "Tests 1-2 account cleanup failed: $_" -ForegroundColor Yellow
    }
}

exit $exitCode
