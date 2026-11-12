# CTMS-099 — Compare Weather Risk Results with Manual Assessment

## 1. Overview

Story: CTMS-099

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: Compare Weather Risk Results with Manual Assessment

Priority: Must Have

Goal: Evaluate automated Weather Risk classification against a versioned manual-assessment test set using approved V3 agreement and high-risk safety gates.

Backlog story: As the System, I want to compare Weather Risk results with manual assessment so the risk-classification mechanism can be objectively validated.

Acceptance Criteria:

| Source  | Criterion                                               |
| ------- | ------------------------------------------------------- |
| PB AC-1 | Evaluation uses a versioned manual-assessment test set. |
| PB AC-2 | Overall agreement is measured.                          |
| PB AC-3 | Missed Red/high-risk rate is measured.                  |
| PB AC-4 | False Red warning rate is measured.                     |
| PB AC-5 | Overall agreement must be ≥90%.                         |
| PB AC-6 | Missed Red/high-risk rate must be ≤5%.                  |
| PB AC-7 | False Red warning rate must be ≤10%.                    |
| PB AC-8 | Report separates Green/Yellow/Red results.              |
| PB AC-9 | Report stores Weather Risk rule version.                |

## 2. Scope

### In Scope

- Versioned manual assessment.
- Automated/manual comparison.
- Green/Yellow/Red breakdown.
- Agreement.
- Missed high-risk cases.
- False Red warnings.
- Weather-rule version.

### Out of Scope

- Changing Weather Risk rules during evaluation.
- Manual override of production risk result.

## 3. Actors & Authorization

Actor:

- System/evaluation process.
- Authorized evaluator where applicable.

## 4. Preconditions & Dependencies

Weather Risk mechanism exists.

Versioned manual-assessment test set exists.

Weather-rule version is known.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-280 | Weather Risk evaluation must use a versioned manual-assessment test set. Release gates are overall agreement >=90%, missed Red/high-risk rate <=5%, and false Red warning rate <=10%. The report must break out Green/Yellow/Red results and store the weather-rule version.                                                                                           |
| BR-282 | The V3 release gates defined in BR-276 through BR-281 and BR-434 through BR-438 are approved acceptance thresholds. Each evaluation report must store the dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Metrics explicitly designated as observational are reported only and must not independently fail the release. |

## 6. State & Lifecycle

Manual test set selected
→ automated Weather Risk calculated
→ classifications compared
→ metrics calculated
→ release gates evaluated
→ Pass/Fail report.

## 7. Business Flow

1. Load versioned manual-assessment dataset.
2. Record Weather Risk rule version.
3. Run automated Weather Risk evaluation.
4. Compare each automated result with manual assessment.
5. Separate Green/Yellow/Red results.
6. Calculate overall agreement.
7. Calculate missed Red/high-risk rate.
8. Calculate false Red warning rate.
9. Compare with approved gates.
10. Persist report.

## 8. Data & Invariants

Release gates:

- overall agreement ≥90%;
- missed Red/high-risk ≤5%;
- false Red warning ≤10%.

Report must identify dataset and weather-rule versions.

## 9. API / Integration Contract

Admin only (`JwtAuthGuard` + `RolesGuard`, role `admin`), base path `/api/evaluations/weather-risk` (see §13):

| Method | Path | Result |
| --- | --- | --- |
| POST | `/run` body `{ datasetVersion?, ruleVersion? }` | 201 report; 404 unknown dataset or rule version; 409 no active rule; 400/422 invalid body |
| GET | `/datasets` | Versioned manual-assessment sets with status, hash and per-level counts |
| GET | `/latest` | Newest report; 404 when none |
| GET | `/reports?limit=` | Reports newest first (default 20, max 100) |
| GET | `/reports/:id` | One report; 422 bad id; 404 unknown |

## 10. Error & Edge Cases

| Case                  | Expected Behavior                      |
| --------------------- | -------------------------------------- |
| Agreement =90%        | Pass                                   |
| Agreement <90%        | Fail                                   |
| Missed Red =5%        | Pass                                   |
| Missed Red >5%        | Fail                                   |
| False Red =10%        | Pass                                   |
| False Red >10%        | Fail                                   |
| Dataset not versioned | Evaluation evidence invalid/incomplete |
| Rule version changes  | Report as separate evaluation context  |

## 11. Acceptance & Test Matrix

| Source | Scenario         | Expected Result                        | Test Type    |
| ------ | ---------------- | -------------------------------------- | ------------ |
| BR-280 | Agreement ≥90%   | Pass                                   | Evaluation   |
| BR-280 | Agreement <90%   | Fail                                   | Evaluation   |
| BR-280 | Missed Red ≤5%   | Pass                                   | Safety       |
| BR-280 | Missed Red >5%   | Fail                                   | Safety       |
| BR-280 | False Red ≤10%   | Pass                                   | Evaluation   |
| BR-280 | Green/Yellow/Red | Separately reported                    | Metrics      |
| BR-282 | Report           | Dataset/rule/threshold/result retained | Traceability |

## 12. Open Decisions

None for V3 release thresholds. Metric definitions and the draft dataset are recorded in §13.

## 13. Implementation Record — Logic (Jira CTMS-401, [CTMS-099-T01])

Branch `feat/CTMS-401-compare-weather-risk-manual-assessment-logic`. Module `services/api/src/modules/weather-risk-evaluation`, same shape as `overbooking-evaluation` / `sync-evaluation`.

**Versioned manual-assessment set (AC-1).**
- Stored as data-only TypeScript files in `weather-risk-evaluation/datasets/` (`manual-assessment.v1.ts`), registered in `datasets/index.ts`; the newest version is the default. TypeScript instead of JSON because the API build does not copy `.json` files (no `resolveJsonModule` / Nest assets); the content is still plain data reviewed in a PR.
- Each case: id, worst-hour readings (rain mm/h, wind km/h, °C, visibility m, thunderstorm), manual level, boundary flag, note. A published version is never edited; new labels mean a new version.
- Each report stores the dataset version, its status and the SHA-256 of its content, so the exact labels are traceable.
- **v1 (`v1-2026-11-draft`)**: 60 cases, 20 per level, 18 near a threshold (6 per level). Labels were drafted by the dev team from the weather decision policy **without running the scorer** and are a **draft** (approved decision B, 2026-11-13). A guide or the leader must confirm the labels and set `status: "approved"`, `approvedBy`, `approvedAt` in a PR; until then every report is `INVALID`.

**Metrics (AC-2..4, AC-8).**
- Overall agreement = cases where the scorer level equals the manual level / all cases.
- Missed Red/high-risk rate = manual Red cases the scorer did not call Red / manual Red cases (Red = high risk).
- False Red warning rate = Red warnings the scorer issued that the evaluator did not label Red / Red warnings issued; 0 when no Red warning was issued (approved decision A, 2026-11-13).
- Green/Yellow/Red breakdown keyed by manual level (cases, agreed, agreement, how the scorer classified them) — a 3×3 confusion matrix.
- Boundary and non-boundary agreement are reported separately and are observational only (BR-282): they never fail the release.
- Rates are fractions rounded to 4 decimals, like the other evaluation reports.

**Release gates and conclusion (AC-5..7, §10).**
- Gates are decided on integer counts so a value exactly at a threshold passes: agreed×100 ≥ 90×total; missed×100 ≤ 5×manual Red; false×100 ≤ 10×Red warnings.
- `PASSED` when all three gates pass on an approved dataset; `FAILED` with one reason per failed gate citing BR-280 and the AC; `INVALID` when the dataset is a draft, has no case or has no Red case (missed Red rate cannot be measured; it is reported as null).

**Report (AC-9, BR-282).** Table `weather_risk_evaluation_reports` (migration `1795400000000`): dataset version / hash / status, config version `v3-weather-risk-evaluation-1`, rule id and version plus a snapshot of every threshold, weight and score cap, gates (threshold, actual, comparator, passed), metrics, every case result, failure reasons, evaluator and time. A different rule version is a separate evaluation context (`ruleVersion` in the request, indexed with the dataset version). The evaluation only reads the rule (§2 Out of Scope).

**Scorer.** Cases are scored with the production function `scoreWeatherReading` (BR-041), so the evaluation measures exactly what Trips get.

**Finding (not changed, out of scope).** With the default rule (rain 10/50, wind 40/70, visibility 5 000/1 000, weights 0.30/0.25/0.15/0.15/0.15, caps 0.5/1.2), the v1 draft gives overall agreement 38.33% (23/60), missed Red 90% (18/20) and false Red 0% (0/2): Green 20/20, Yellow 1/20 (19 scored Green), Red 2/20 (12 Yellow, 6 Green). The weighted sum needs several criteria at once: one criterion at Red scores 2×weight (e.g. heavy rain 2×0.30 = 0.60, Yellow) and one criterion at Yellow stays Green. Once the labels are approved, the leader should decide whether the rule (weights / score caps) or the labels change; that is a rule change, outside this task.

## 14. Test Evidence — CTMS-401

- Unit `weather-risk-evaluation.metrics.spec.ts` and `weather-risk-evaluation.service.spec.ts` (17): metric definitions, Green/Yellow/Red breakdown, boundary slices, each gate exactly at and just past its threshold, no Red warning, PASSED / FAILED / INVALID, dataset well-formedness and hash, rule selection, 404/409, history bounds.
- Integration `test/weather-risk-evaluation.integration-spec.ts` (3, real Postgres): run with the active rule stores dataset version/hash, rule id/version/snapshot, gates and `INVALID` for the draft; another rule version is a separate context and the rule stays inactive; datasets list; 404 / 409 / invalid body / 422 bad id; Host 403, anonymous 401.
- Weather and evaluation integration suites: weather (7 suites) pass; `sync-evaluation` (4) and `overbooking-evaluation` (4) fail identically on develop (`bm.trip_id`, `CHK_trips_duration_by_type`), pre-existing and untouched.
- API jest: 206 suites, 2492 tests passed. `lint:all` 0 errors. `build:all` passes. Backend only, no UI (the UI is the next subtask).

### DoD — CTMS-401

- [x] Logic implementation completed
- [x] Applicable business rules/invariants implemented (BR-280, BR-282)
- [x] Task-specific unit tests added and passed
- [x] Applicable backend/integration tests passed (pre-existing failures noted above)
- [x] Story Acceptance Criteria AC-1..AC-9 covered by tests
- [x] Unit regression tests passed
- [ ] Applicable E2E — none: backend only
- [x] lint:all passed
- [x] build:all passed
- [ ] Required CI checks — after the PR is opened

### Pending decision

- Confirm the v1 labels (or provide guide-labelled cases) and approve the dataset; then decide on the rule given the finding above.
