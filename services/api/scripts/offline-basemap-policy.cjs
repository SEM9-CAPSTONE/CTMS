const { createHash } = require('node:crypto');
const { unzipSync } = require('fflate');

function readRoute(archive, expectedHash) {
  if (createHash('sha256').update(archive).digest('hex') !== expectedHash)
    throw Error('CORE_INTEGRITY_FAILED');
  let route;
  try { route = JSON.parse(Buffer.from(unzipSync(archive)['route.geojson']).toString('utf8')); }
  catch { throw Error('ROUTE_INVALID'); }
  const points = route?.geometry?.coordinates;
  if (route?.geometry?.type !== 'LineString' || !Array.isArray(points) || points.length < 2 ||
      points.some(p => !Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) >= 85))
    throw Error('ROUTE_INVALID');
  return points;
}

function readMapPoints(archive, expectedHash) {
  const route = readRoute(archive, expectedHash);
  let checkpoints;
  try {
    checkpoints = JSON.parse(Buffer.from(unzipSync(archive)['checkpoints.json']).toString('utf8'));
  } catch { throw Error('CHECKPOINTS_INVALID'); }
  if (!Array.isArray(checkpoints) || checkpoints.some(cp => cp?.location?.type !== 'Point' ||
      !validPoint(cp.location.coordinates))) throw Error('CHECKPOINTS_INVALID');
  return [...route, ...checkpoints.map(cp => cp.location.coordinates)];
}

function validPoint(p) {
  return Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
    Math.abs(p[0]) <= 180 && Math.abs(p[1]) < 85;
}

function routeBounds(points, bufferMeters = 1500) {
  if (!Array.isArray(points) || !points.length || points.some(p => !validPoint(p)))
    throw Error('ROUTE_INVALID');
  if (!Number.isFinite(bufferMeters) || bufferMeters < 1500 || bufferMeters > 5000)
    throw Error('BUFFER_INVALID');
  const latitudes = points.map(p => p[1]);
  const longitudes = points.map(p => p[0]);
  const south = Math.min(...latitudes), north = Math.max(...latitudes);
  const west = Math.min(...longitudes), east = Math.max(...longitudes);
  if (east - west > 180) throw Error('ANTIMERIDIAN_UNSUPPORTED');
  // Conservative longitude padding at the furthest buffered latitude; not a safety corridor.
  const latitudePadding = bufferMeters / 110000;
  const padding = latitudePadding / Math.cos((Math.max(Math.abs(south), Math.abs(north)) + latitudePadding) * Math.PI / 180);
  const bounds = [west-padding,south-latitudePadding,east+padding,north+latitudePadding];
  if (bounds[0] < -180 || bounds[2] > 180 || bounds[1] <= -85 || bounds[3] >= 85)
    throw Error('REGION_UNSUPPORTED');
  const height = (bounds[3]-bounds[1])*111320;
  const nearestLatitude = bounds[1]<=0 && bounds[3]>=0 ? 0 : Math.min(Math.abs(bounds[1]),Math.abs(bounds[3]));
  const width = (bounds[2]-bounds[0])*111320*Math.cos(nearestLatitude*Math.PI/180);
  if (height > 50000 || width > 50000) throw Error('REGION_TOO_LARGE');
  let tiles = 0;
  for (let z=12; z<=16; z++) {
    const count = 2**z;
    const x = lon => Math.floor((lon+180)/360*count);
    const y = lat => Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*count);
    tiles += (x(bounds[2])-x(bounds[0])+1)*(y(bounds[1])-y(bounds[3])+1);
  }
  if (tiles > 5000) throw Error('TILE_LIMIT_EXCEEDED');
  return bounds;
}

function assertCoverage(bounds, points) {
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) ||
      !(-180 <= bounds[0] && bounds[0] < bounds[2] && bounds[2] <= 180 &&
        -85 < bounds[1] && bounds[1] < bounds[3] && bounds[3] < 85)) throw Error('BOUNDS_INVALID');
  if (points.some(([lon,lat]) => lon<bounds[0] || lon>bounds[2] || lat<bounds[1] || lat>bounds[3]))
    throw Error('COVERAGE_INCOMPLETE');
}
module.exports = { readRoute, readMapPoints, routeBounds, assertCoverage };
