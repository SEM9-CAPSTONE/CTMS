# Proposed upstream tasks required by CTMS-052

Status: proposed repository specification, 2026-11-06; no Jira ticket has been created. These are dependencies, not implementations delivered in 052.

## Host Verify Field Hazard Report

Owner: new task alongside CTMS-086. BR-269's handling workflow is retained. Verification is independent of `open/investigating/resolved/closed` and restricted to the authoritative Trip/Route Host. Persist report ID, decision/version, authorized Host ID, evidence reference, decision time, reason, rejection and revocation history. Re-check ownership server-side; a client-supplied Host ID is not authority. No status transition implies approval. Test authorized approval, unauthorized/cross-Host denial, missing evidence, concurrent decisions, rejection and revocation. Extending Camper reporting requires a separately approved CTMS-049 permission change.

## Promote Verified Field Report to Safety Source

Owner: new safety-source task integrating Route Safety. Consume an explicit valid Host decision, not incident lifecycle or a GPS hotspot. Publish a versioned `FIELD_VERIFIED` feature with report/decision references, geometry/role/accuracy, source version, validFrom/validUntil, lifecycle and Route impact. Keep verification audit internal; package projections minimize actor identifiers. Reject unverified/rejected/revoked/expired decisions. Revocation and expiry must invalidate current consumption and notify 119 impact analysis. Do not label field evidence GOVERNMENT. Test spatial matching, version idempotency, revoke/repromote, source update races and attribution.

## Approve Safety Guidance Applicability

Owner: proposed extension/new task integrating 050/051. An Admin approves a complete guidance unit once, with taxonomy version, applicable/excluded conditions, coverage topic, approval ID/version/actor/time, exact document version/checksum, active READY chunk set and ordered chunk/page references, source title/attribution/locale and full warnings/steps. AI may suggest but cannot approve. Publish a versioned coverage policy specifying baseline topics, condition/hazard topic rules, required condition evidence and official sources. Apply CTMS-050 BR-227 for current publication and BR-484 for source eligibility, including professional and translation checks. Guidance is an approved extract, while original-PDF distribution has its own permission boundary. Live approval references to sets or chunks must use restrictive foreign keys. Lock relevant survival document rows in ID order before reading chunk rows for final revalidation. Stop-use/delete/revoke invalidates current reads and preserves historical package artifacts. Test unlisted sources, inactive sets, unapproved or fragmented guidance, unknown conditions, concurrent cleanup and source withdrawal.

## Normalized package safety read contract

Owner: CTMS-010/safety-source infrastructure and guidance approval owners. Implement `OfflineSafetySources` in `services/api/src/modules/offline-packages`. Reads are database-only, within the caller's consistent snapshot. The locking read must lock all relevant source/policy/approval publication rows and a scope/revision row covering inserts/deletes; writers must acquire conflicting locks. This prevents a new hazard or source withdrawal appearing between revalidation and READY commit. External ingestion completes before these reads, never during the generator transaction.

Expose complete feed-run identities and successful empty results separately from UNAVAILABLE/PARTIAL/STALE; preserve provider validity and checkedAt without refreshing validity at fetch time. Required sources come from the approved policy, not an empty array by omission. Produce only spatially matched features with explicit match evidence. Fail closed while this infrastructure is absent. Contract fixtures belong only in tests.
