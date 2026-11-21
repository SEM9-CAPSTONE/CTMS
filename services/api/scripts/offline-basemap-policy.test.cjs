const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { zipSync } = require('fflate');
const { readRoute, readMapPoints, routeBounds, assertCoverage } = require('./offline-basemap-policy.cjs');
function artifact(geometry, checkpoints = []) {
  const bytes = Buffer.from(zipSync({'route.geojson':Buffer.from(JSON.stringify({geometry})),
    'checkpoints.json':Buffer.from(JSON.stringify(checkpoints))}));
  return [bytes,createHash('sha256').update(bytes).digest('hex')];
}
test('reads measured route from hash-verified immutable package', () => {
  const points = [[108.2,16.1],[108.3,16.2]];
  assert.deepEqual(readRoute(...artifact({type:'LineString',coordinates:points})),points);
});
test('rejects changed archive before parsing geometry', () => {
  const [bytes] = artifact({type:'LineString',coordinates:[[1,2],[3,4]]});
  assert.throws(() => readRoute(bytes,'0'.repeat(64)),/CORE_INTEGRITY/);
});
test('rejects invalid coordinates and incompatible geometries', () => {
  for (const geometry of [{type:'Point',coordinates:[1,2]},
    {type:'LineString',coordinates:[[181,2],[3,4]]},
    {type:'LineString',coordinates:[[1,90],[3,4]]}]) {
    assert.throws(() => readRoute(...artifact(geometry)),/ROUTE_INVALID/);
  }
});
test('bounds are per route and contain every point with a buffer', () => {
  for (const points of [[[108.2,16.1],[108.3,16.2]],[[105,10],[105.01,10.02]]]) {
    const [w,s,e,n] = routeBounds(points);
    assert.ok(points.every(([lon,lat]) => lon>w && lon<e && lat>s && lat<n));
  }
});
test('rejects antimeridian rather than generating a near-world extract', () => {
  assert.throws(() => routeBounds([[179,10],[-179,11]]),/ANTIMERIDIAN/);
});
test('distant checkpoint expands coverage beyond the route with at least 1500 m padding', () => {
  const route=[[108.27,16.1],[108.28,16.11]];
  const checkpoint={location:{type:'Point',coordinates:[108.32,16.14]}};
  const points=readMapPoints(...artifact({type:'LineString',coordinates:route},[checkpoint]));
  const bounds=routeBounds(points);
  assertCoverage(bounds,points);
  assert.ok((bounds[3]-16.14)*111000>=1499.99);
  assert.ok(bounds[2]>routeBounds(route)[2]);
  assert.throws(() => assertCoverage(routeBounds(route),points),/COVERAGE_INCOMPLETE/);
});
test('rejects malformed checkpoints and changed package before coverage computation', () => {
  const geometry={type:'LineString',coordinates:[[108.27,16.1],[108.28,16.11]]};
  for (const checkpoint of [{}, {location:{type:'Point',coordinates:[108,91]}}])
    assert.throws(() => readMapPoints(...artifact(geometry,[checkpoint])),/CHECKPOINTS_INVALID/);
  const [bytes]=artifact(geometry);
  assert.throws(() => readMapPoints(bytes,'0'.repeat(64)),/CORE_INTEGRITY_FAILED/);
});
test('rejects large regions, excessive tiles, polar bounds and invalid buffers before fetching', () => {
  assert.throws(() => routeBounds([[108,16],[109,17]]),/REGION_TOO_LARGE/);
  assert.throws(() => routeBounds([[108,16],[108.35,16.35]]),/TILE_LIMIT_EXCEEDED/);
  assert.throws(() => routeBounds([[108,84.999],[108.01,84.999]]),/REGION_UNSUPPORTED/);
  assert.throws(() => routeBounds([[108,16]],0),/BUFFER_INVALID/);
  assert.throws(() => routeBounds([[NaN,16]]),/ROUTE_INVALID/);
});
test('coverage rejects malformed metadata bounds instead of accepting NaN comparisons', () => {
  for (const bounds of [[NaN,0,1,1],[1,0,0,1],[0,0,1],[-180,-86,180,86]])
    assert.throws(() => assertCoverage(bounds,[[0,0]]),/BOUNDS_INVALID/);
});
