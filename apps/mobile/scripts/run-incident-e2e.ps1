param(
    [string]$DeviceId = 'emulator-5554',
    [string]$Adb = "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe",
    [string]$DeviceHost = '127.0.0.1'
)

$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workspaceRoot = (Resolve-Path (Join-Path $mobileRoot '../..')).Path
$apiRoot = Join-Path $workspaceRoot 'services/api'
$logs = Join-Path ([IO.Path]::GetTempPath()) ("ctms49-e2e-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $logs | Out-Null
Write-Host "CTMS49 logs: $logs"

$apiProcess = $null
$proxyProcess = $null
$fixtureBase64 = $null
$previousGradleOptions = $env:GRADLE_OPTS
$reverseCreated = @()
$forwarded = @()
$appId = 'com.ctms.mobile'
$phaseResults = [ordered]@{ capture = 'NOT RUN'; recover = 'NOT RUN' }

function Invoke-Logged([string]$Command, [string[]]$Arguments) {
    Write-Host "> $Command $($Arguments -join ' ')"
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')" }
}

function Get-AppPid {
    $value = (& $Adb -s $DeviceId shell pidof $appId) -join ''
    return $value.Trim()
}

function Test-AppInstalled {
    return ((& $Adb -s $DeviceId shell pm path $appId) -join "`n") -match '^package:'
}

function Stop-App {
    Invoke-Logged $Adb @('-s', $DeviceId, 'shell', 'am', 'force-stop', $appId)
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    while ((Get-AppPid) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 200 }
    if (Get-AppPid) { throw 'Application process is still alive after force-stop.' }
}

function Wait-VmService([string]$ProcessId) {
    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    while ([DateTime]::UtcNow -lt $deadline) {
        $log = (& $Adb -s $DeviceId logcat -d "--pid=$ProcessId" -s flutter) -join "`n"
        $match = [regex]::Match($log, 'listening on (http://127\.0\.0\.1:\d+/[^\s]*)')
        if ($match.Success) { return $match.Groups[1].Value }
        Start-Sleep -Milliseconds 500
    }
    throw "Dart VM service URL not found in logcat. See $logs"
}

function Get-IncidentId([string]$Phase) {
    $log = Get-Content -Raw (Join-Path $logs "$Phase-logcat.txt")
    $match = [regex]::Match($log, "CTMS49_INCIDENT phase=$Phase id=([0-9a-f-]{36})")
    if ($match.Success) { return $match.Groups[1].Value }
    return $null
}

function Wait-Http([string]$Url) {
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing | Out-Null
            return
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw "Test service did not start: $Url. See $logs"
}

function Invoke-Fixture([string]$Action, [string]$Payload = '') {
    Push-Location $apiRoot
    try {
        $result = & node node_modules/ts-node/dist/bin.js --transpile-only test/e2e/incident-fixture.ts $Action $Payload
        if ($LASTEXITCODE -ne 0) { throw "Fixture $Action failed" }
        return ($result -join "`n")
    } finally {
        Pop-Location
    }
}

try {
    if (!(Test-Path -LiteralPath $Adb)) {
        throw 'ADB not found. Pass -Adb with its absolute path.'
    }

    $deviceState = & $Adb -s $DeviceId get-state
    if ($LASTEXITCODE -ne 0 -or $deviceState -ne 'device') {
        throw "Start Android test device $DeviceId first."
    }

    if ($DeviceHost -in @('127.0.0.1', 'localhost')) {
        $existingReverse = (& $Adb -s $DeviceId reverse --list) -join "`n"
        foreach ($port in @(3002, 3003)) {
            if ($existingReverse -match "(?m)\btcp:$port\s+tcp:$port\s*$") { continue }
            if ($existingReverse -match "(?m)\btcp:$port\s+") {
                throw "ADB reverse port $port already targets another service."
            }
            & $Adb -s $DeviceId reverse "tcp:$port" "tcp:$port"
            if ($LASTEXITCODE -ne 0) {
                throw "Could not forward test port $port to device $DeviceId."
            }
            $reverseCreated += $port
        }
    }

    foreach ($port in @(3002, 3003)) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
            throw "Port $port is busy. Stop the other CTMS49 E2E run first."
        }
    }

    $apiProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @(
        'node_modules/ts-node/dist/bin.js', '--transpile-only', 'test/e2e/start-incidents-server.ts'
    ) -WorkingDirectory $apiRoot -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput (Join-Path $logs 'api.log') `
      -RedirectStandardError (Join-Path $logs 'api-error.log')

    $proxyProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @(
        'node_modules/ts-node/dist/bin.js', '--transpile-only', 'test/e2e/incident-network-proxy.ts'
    ) -WorkingDirectory $apiRoot -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput (Join-Path $logs 'proxy.log') `
      -RedirectStandardError (Join-Path $logs 'proxy-error.log')

    Wait-Http 'http://127.0.0.1:3002/api/docs'
    Wait-Http 'http://127.0.0.1:3003/__e2e/health'
    Write-Host 'CTMS49 test services ready.'

    $fixtureJson = Invoke-Fixture 'seed'
    $fixtureBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($fixtureJson))
    Write-Host 'CTMS49 isolated fixture ready.'

    $env:GRADLE_OPTS = "$previousGradleOptions -Dorg.gradle.project.kotlin.incremental=false -Dorg.gradle.project.kotlin.compiler.execution.strategy=in-process"

    Push-Location $mobileRoot
    try {
        # Build once with the test entry point and defines; flutter drive only attaches later.
        Invoke-Logged 'flutter' @(
            'build', 'apk', '--debug', '--no-pub',
            '--target=integration_test/report_trip_incident_test.dart',
            "--dart-define=API_BASE_URL=http://${DeviceHost}:3003/api",
            "--dart-define=E2E_DIRECT_API=http://${DeviceHost}:3002/api",
            "--dart-define=E2E_PROXY=http://${DeviceHost}:3003"
        )
        $apk = Join-Path $mobileRoot 'build/app/outputs/flutter-apk/app-debug.apk'
        # Install once. `-r` replaces the binary without clearing app data.
        Invoke-Logged $Adb @('-s', $DeviceId, 'install', '-r', '-t', $apk)

        Invoke-Logged $Adb @('-s', $DeviceId, 'shell', 'pm', 'grant', $appId, 'android.permission.ACCESS_FINE_LOCATION')
        Invoke-Logged $Adb @('-s', $DeviceId, 'shell', 'pm', 'grant', $appId, 'android.permission.ACCESS_COARSE_LOCATION')
        if ($DeviceId.StartsWith('emulator-')) {
            Invoke-Logged $Adb @('-s', $DeviceId, 'emu', 'geo', 'fix', '108.234567', '16.054321')
        }

        $capturePid = $null
        foreach ($phase in @('capture', 'recover')) {
            Write-Host "CTMS49 native E2E: $phase"
            $scenario = @{ phase = $phase; fixture = ($fixtureJson | ConvertFrom-Json) }
            if ($phase -eq 'recover') { $scenario.previousPid = [int]$capturePid }
            Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3003/__e2e/scenario' `
                -ContentType 'application/json' `
                -Body ($scenario | ConvertTo-Json -Depth 10 -Compress) | Out-Null

            Stop-App
            # Only the main buffer can be cleared on emulators; reads are also scoped by PID.
            Invoke-Logged $Adb @('-s', $DeviceId, 'logcat', '-b', 'main', '-c')
            Invoke-Logged $Adb @('-s', $DeviceId, 'shell', 'am', 'start', '-W', '-n', "$appId/.MainActivity")
            $phasePid = Get-AppPid
            if (!$phasePid) { throw "CTMS49 [$phase]: application process did not start." }
            if ($phase -eq 'capture') { $capturePid = $phasePid }
            elseif ($phasePid -eq $capturePid) { throw 'CTMS49 [recover]: process was not restarted.' }
            Write-Host "CTMS49 [$phase]: application PID $phasePid"

            $deviceVmService = Wait-VmService $phasePid
            $deviceUri = [Uri]$deviceVmService
            $hostPort = (& $Adb -s $DeviceId forward 'tcp:0' "tcp:$($deviceUri.Port)" | Select-Object -Last 1).Trim()
            if ($LASTEXITCODE -ne 0 -or !$hostPort) { throw 'Could not forward the VM service port.' }
            $forwarded += $hostPort
            $hostVmService = "http://127.0.0.1:$hostPort$($deviceUri.AbsolutePath)"

            # --use-existing-app attaches only: no build, no install, no uninstall afterwards.
            $driveArgs = @(
                'drive',
                '--driver=test_driver/integration_test.dart',
                '--target=integration_test/report_trip_incident_test.dart',
                '-d', $DeviceId,
                '--no-pub',
                "--use-existing-app=$hostVmService",
                '--keep-app-running'
            )
            Write-Host "> flutter $($driveArgs -join ' ')"
            & flutter @driveArgs
            $testExitCode = $LASTEXITCODE
            & $Adb -s $DeviceId logcat -d "--pid=$phasePid" -s flutter | Set-Content -Encoding utf8 (Join-Path $logs "$phase-logcat.txt")
            $phaseResults[$phase] = if ($testExitCode -eq 0) { 'PASS' } else { 'FAIL' }

            if (!(Test-AppInstalled)) { throw "CTMS49 [$phase]: application was removed from the device." }
            Write-Host "CTMS49 [$phase]: $($phaseResults[$phase]); application still installed."
            if ($testExitCode -ne 0) { throw "Native E2E $phase failed. See $logs" }

            # Real process death before recover: data on disk must be all that survives.
            Stop-App
        }

        $captureId = Get-IncidentId 'capture'
        $recoverId = Get-IncidentId 'recover'
        if (!$captureId -or $captureId -ne $recoverId) {
            throw "Incident UUID changed between phases: capture=$captureId recover=$recoverId"
        }
        Write-Host "CTMS49 incident UUID preserved: $captureId"
    } finally {
        Pop-Location
    }

    Write-Host 'CTMS49 native E2E passed: capture + real process restart + recover.'
} finally {
    foreach ($entry in $phaseResults.GetEnumerator()) { Write-Host "CTMS49 phase $($entry.Key): $($entry.Value)" }
    $env:GRADLE_OPTS = $previousGradleOptions
    try {
        if ($fixtureBase64) { Invoke-Fixture 'clean' $fixtureBase64 | Out-Null }
    } finally {
        if ($proxyProcess -and !$proxyProcess.HasExited) { Stop-Process -Id $proxyProcess.Id }
        if ($apiProcess -and !$apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id }
        foreach ($port in $forwarded) {
            & $Adb -s $DeviceId forward --remove "tcp:$port" | Out-Null
        }
        foreach ($port in $reverseCreated) {
            & $Adb -s $DeviceId reverse --remove "tcp:$port" | Out-Null
        }
    }
}