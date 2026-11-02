# CTMS-395 GPS deviation simulation

This development-only CLI imports the production CTMS-245 Dart detector. It adds
no app startup hooks, GPS subscriptions, timers, background workers, network calls,
or runtime dependencies. No Route/Trip or detector business logic is modified.

From the repository root (Dart SDK on PATH):

```powershell
dart apps/mobile/tool/gps_evaluation/metrics_test.dart
dart apps/mobile/tool/gps_evaluation/replay.dart --output test-results/ctms-395/simulation.json
```

The output path must be outside source control or ignored. Do not commit generated
reports. No database, seed, Flutter build or device is needed. The CLI can run with
the Dart executable bundled in Flutter. A missing Flutter package configuration
may produce an analyzer include warning; the scripts themselves only use Dart SDK
libraries and existing pure domain files.

## Policy ctms395-simulation-v1

- B is primary: predefined half-open situations [start, end). Positive situations
  are clean-track off-route episodes; negative situations are scripted on-route
  portions, fixed before predictions. No automatic splitting based on alerts.
- Truth comes from the scripted clean track before adding seeded +/-3 m noise.
  Off-route begins above 50 m and ends below 20 m. The buffer keeps the previous
  truth state. This is synthetic truth, not independently surveyed field truth.
- FPR = negative situations with >=1 OFF_ROUTE / eligible negative situations.
  FNR = positive situations with no OFF_ROUTE / eligible positive situations.
  Rates are fractions. Do not average rates across scenarios.
- First OFF_ROUTE within the episode is matched. Extra alerts are reported as
  repeats. An alert outside the positive episode cannot rescue that episode.
- Latency is confirming event time minus truth onset, never server received_at.
  P95 uses nearest rank. Misses remain FN; no detections means unavailable P95.
- Replay preserves 10-second samples of all accuracy levels. Production validity
  remains <=20 m. A confirming alert is evidence-eligible only after three
  consecutive <=10 m samples. Situations need at least one uninterrupted run of
  three <=10 m samples, and any excluded-quality alert excludes the situation.
  Exclusions are explicit; insufficient quality never becomes a zero rate.
- A is supplementary: sample FPR=FP/(FP+TN), FNR=FN/(FN+TP), <=10 m only.
  These include the detector's confirmation delay and have no independent gate.
- Primary thresholds are FPR<=0.05, FNR<=0.02, P95<=30 s. Missing denominator,
  missing P95 or excluded situations produce an incomplete simulation result.
- All reports have releaseConclusion=incomplete, regardless of simulation results.
  Field truth and checkpoint evaluation are absent. The CLI's successful exit
  means report generation succeeded, not that release gates passed.

## Current scenarios and limits

Scenarios cover on-route jitter, sustained deviation/recovery, 49 m boundary
jitter, short excursion, accuracy 15 m, accuracy 25 m and signal loss. Each starts
a new detector to avoid mixing trips or scenario state. Tick replay uses 5 s,
matching the current production controller; samples use 10 s.

The generator is a fixed small demonstration set, not statistical validation.
No field accuracy claims, synchronization integration claims or battery savings
measurements are made. Checkpoint detection and raw external dataset import are
not implemented by this first simulation runner. Existing runtime sync tests
remain separate. Package version is explicitly unavailable, never fabricated.

The report preserves the route geometry, seed, dataset/policy/config versions,
detector source path and Git commit. The CLI rejects dirty detector sources.
