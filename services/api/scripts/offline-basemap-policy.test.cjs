const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { zipSync } = require('fflate');
const { readRoute, routeBounds } = require('./offline-basemap-policy.cjs');
function artifact(geometry) {
  const bytes = Buffer.from(zipSync({'route.geojson':Buffer.from(JSON.stringify({geometry}))}));
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
