# CTMS-374 — Host monitoring alerts

Base: `b6bfca56` (CTMS-370, PR #900). The existing `/host/trip-map` page retains
the Vietnamese monitoring title and its member map. This UI consumes CTMS-373;
it does not calculate route deviation or schedule progress and adds no API permissions.

## Data and selection

- A single TanStack Query cycle reads the authorized active maps and the selected
  Trip's unfiltered alerts concurrently every 30 seconds. The header refresh button
  invalidates that cycle. Both results are published together; these remain separate
  server reads, not a transactional snapshot. The common timestamp records completion
  of the refresh, not the time GPS was captured. An alert failure remains explicit
  while available map positions are retained.
- Selected participant details refresh after that cycle, rather than using a separate
  polling timer. Selection uses `{ tripId, role, participantId }`; Camper IDs are
  booking-member IDs. Changing Trip resets selection, tab and alert filters.
- `lastSeenAt` (map) and `lastLocationAt` (alerts) use the same freshness helper with
  each response's server-provided threshold. Both sources retain their capture times;
  synchronized requests cannot guarantee identical captures. Navigation uses the
  member's current authorized map position, never a synthetic duplicate alert marker.
- Two alerts for one member remain two rows and highlight together. Missing members
  produce an inline explanation and preserve any valid previous selection. A member
  without GPS can be selected but cannot be centered on a fabricated position.
- Matching alerts for the selected member are grouped at the top of the fixed-height
  scrollable alert list. Other alerts retain severity/time ordering. No duplicate marker
  or duplicate alert row is created. Each row uses its current map C/P code, when available.
  The detail panel summarizes the selected alert using its current response type,
  severity and observation time; an identical OFF_ROUTE history line is suppressed.
- A filter that matches no alerts deliberately preserves a valid selected member and
  map position. The empty result explains this. Changing Trip clears the selection.

## Filters and lifecycle

- Filters apply to the complete authoritative alert response, with the same AND/null
  semantics as the API. The badge counts all alerts, including two rows for one member;
  it is not a count of unique members. The alert list scrolls within 320 px and has no pagination. Filtering or selecting a different member returns it to the top.
- Schedule severity sorts descending, then observation time descending. Off-route
  alerts retain `severity: null` and their explicit Vietnamese type label. Selecting
  any severity excludes off-route alerts and displays an explanation.
  Unfiltered ordering is SEVERELY_BEHIND, BEHIND, then null-severity OFF_ROUTE;
  the explicitly labelled selected-member group is shown before the remaining sorted rows.
- Per CTMS-085/063, `LOCATION_UNKNOWN` and `ON_TRACK` produce no schedule alert.
  Loss of GPS can therefore remove an existing schedule alert. The member tab remains
  available; an empty alert list must not imply that everyone is safe or on track.
- 403/404 use a generic unavailable/restricted message. 409 clears selection and
  explains that the Trip is no longer ongoing or its map is unavailable, matching
  the endpoint's two possible conflicts. 403/404/409 offer a refresh of the authorized Trip list rather than repeating the failed alert read. Only network/transient errors offer an alert retry.
- Open specification question: should off-route alerts support severity filtering?
  Their authoritative severity mapping remains undefined; this UI does not invent one.

## Local evidence data

Only `services/api/src/seeds/main.seed.ts` contains the opt-in fixture:

```powershell
pnpm --filter @ctms/api exec ts-node --transpile-only src/seeds/main.seed.ts --host-monitoring-only --host-monitoring-group --host-monitoring-alerts
```

It reuses existing accounts and the existing group Trip. GPS, a recovered transition,
and Porter checkpoint confirmations produce current BEHIND/SEVERELY_BEHIND evaluations,
including one member with both alert types, one recovered/on-track member and a member
without GPS. The separate existing two-member Trip supplies an empty alert case.
No user accounts are added, financial records reset, or BEHIND_SCHEDULE rows precomputed.
Only seed-owned operational IDs are refreshed. Rerun immediately before capturing
current schedule alerts: valid GPS older than the backend's five-minute window correctly
becomes LOCATION_UNKNOWN and disappears from schedule alerts.

Browser tests distinguish mocked API behavior from opt-in real API/satellite-map
evidence. Evidence belongs in ignored `test-results/ctms-374`, never in Git.


## Presentation and evidence consistency

The monitoring heading stays constant regardless of Trip counts/statuses. Active tabs
use explicit ARIA-selected styling and a labelled tabpanel; alert errors do not disable
or visually select the member tab. The member list remains accessible while alerts fail.
The map is isolated at z-index 0; the sticky page header is z-index 50, above map controls.
Severity filter labels are distinct from type labels (short Vietnamese levels); enum
values and authoritative row severity labels are unchanged.

Both mocked and live CTMS-374 browser evidence now use the same running Vite server at
localhost:5173, with real satellite tiles. Only API responses differ for negative cases.
The separate CTMS-370 regression config still exercises the intentional fallback map;
those screenshots are not part of the reviewer bundle.

## Member sorting

The member tab offers Attention first (default), Full name A-Z, and C/P code ascending.
Attention first preserves unavailable, stale, fresh priority, then Vietnamese full-name
ordering within each group. Code order compares C before P and source numeric indexes
numerically, so C2 precedes C10. Sorting does not renumber markers, mutate API data,
clear a valid selection, or change filters. Changing order resets the member list to
page 1; its existing pinned selection and reveal-in-list action remain available.
