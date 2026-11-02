# Route terrain analysis

The Host route creation and draft editing form analyzes terrain in the background.
It only shows a short inline validation message beneath the duration input when
that duration is below the CTMS minimum. There is no elevation panel, chart,
estimate, loading indicator, provider diagnostic or manual retry control.
Both creation and draft updates enforce the minimum on the server as well.

## Configuration

- Local API: set `MAPTILER_API_KEY` in `services/api/.env` (or the root `.env`).
- Docker Compose API: set `MAPTILER_API_KEY` in the root `.env` or the environment.
- Use a key permitted for server-side requests. The existing browser map key can be
  restricted to website origins and return HTTP 403 from the backend. Keep browser
  restrictions in place and use a separate server key instead.
- Restart the API after changing environment variables.
- `ROUTE_TERRAIN_ROAD_ENABLED=false` disables optional road metadata lookup.
  This lookup reuses `ROUTE_SAFETY_OVERPASS_URL`, with a separate five-second
  deadline and bounded area/record/node counts. MapTiler remains the elevation source.
- `REDIS_URL` enables the shared seven-day result cache. If Redis is unavailable,
  analysis continues with a bounded in-process cache, lost on restart.

## Behavior

`POST /route-safety/terrain` requires Host authentication and accepts
`{ geometry: { type: "LineString", coordinates: [[longitude, latitude], ...] } }`.

The backend validates a nonzero WGS84 line with at most 10,000 vertices. It takes
samples approximately every 100 meters, capped at 200 per route, and requests up
to 50 elevations per MapTiler call with a 12-second total deadline. Each sampled
coordinate counts toward the provider quota. Requests for the same host and
geometry share an in-flight request and successful results are cached for seven
days. No automatic retry occurs for a failed provider call.

The response contains signed slope between samples, total ascent/descent, maximum
absolute sampled slope, profile, sample spacing, and estimated moving minutes.
Small elevation changes below 3 meters are accumulated with hysteresis to reduce
noise in ascent/descent totals. A failed, incomplete or unavailable provider
response never becomes a successful profile or a zero-meter ascent.

The form debounces geometry edits by 1.2 seconds. Changing duration alone reuses
the current profile and never triggers another elevation request. Geometry changes
immediately hide the previous profile and clearing the line removes the assessment.

The calculation follows TCVN 14602:2026, 14.3.5.2, Table 4 and formula (4):

- Horizontal hours: sum of each leg's kilometers divided by 4, 3 or 2 km/h for
  easy, moderate or hard walking surfaces.
- Vertical hours: total ascent / 200 plus total descent / 300, with heights in meters.
- Reference hours: the larger of horizontal/vertical hours plus 0.5 of the smaller.
- Round up to minutes only at the end. The 10 km moderate / 300 m ascent /
  200 m descent example yields 200 horizontal minutes, 130 vertical minutes,
  and a 265-minute reference result.

The standard defines an exertion index in hours. Choosing it as a minimum for
route saving is a CTMS business rule, not a minimum mandated by TCVN. Route time
does not include Trip waypoint activities, breaks or an automatic return trip.

Road metadata is conservatively matched to the start, midpoint and end of each
sample interval within 20 meters of a mapped walking way. Explicit surface AND
smoothness tags are required: even asphalt/concrete/paving-stone footways are
estimated EASY, even compacted/ground/dirt/earth/grass/fine-gravel ways MODERATE,
rough rock/stone/scree/sand/mud ways with uneven smoothness HARD. This mapping is
a CTMS estimation heuristic, not official terrain certification. Generic paved or
unpaved tags and the route difficulty dropdown do not establish a terrain class.
Unmatched, missing, conflicting or inaccessible metadata remains UNKNOWN.

Only complete road coverage with elevation sampling no wider than 100 meters
uses the combined result as the saving minimum. Unknown road legs use a provisional
4 km/h horizontal contribution and mark the result PARTIAL. Missing elevation
remains null and marks the result DISTANCE_ONLY. In incomplete cases the saving
minimum is the distance-only 4 km/h floor, rather than an unverified full assessment.

Long routes have coarser sampling and may miss short steep sections. The drawn
line must follow the actual trail; this feature does not route or snap straight
lines to paths. Road metadata does not verify that a trail is currently passable.

Provider contract: https://docs.maptiler.com/cloud/api/elevation/
Standard: https://images.vietnamtourism.gov.vn/vn/dmdocuments/2026/tcvn_14602_2026.pdf
