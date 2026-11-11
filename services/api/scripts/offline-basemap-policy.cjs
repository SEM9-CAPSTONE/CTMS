const { createHash } = require('node:crypto');
const { unzipSync } = require('fflate');

function readRoute(archive, expectedHash) {
  if (createHash('sha256').update(archive).digest('hex') !== expectedHash)
    throw Error('CORE_INTEGRITY_FAILED');
  const route = JSON.parse(Buffer.from(unzipSync(archive)['route.geojson']).toString('utf8'));
  const points = route.geometry?.coordinates;
  if (route.geometry?.type !== 'LineString' || !Array.isArray(points) || points.length < 2 ||
      points.some(p => !Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) >= 85))
    throw Error('ROUTE_INVALID');
  return points;
}

function routeBounds(points) {
  // ~1 km or more at supported latitudes; this is coverage, not a safety corridor.
  const latitudes = points.map(p => p[1]);
  const longitudes = points.map(p => p[0]);
  const south = Math.min(...latitudes), north = Math.max(...latitudes);
  const west = Math.min(...longitudes), east = Math.max(...longitudes);
  if (east - west > 180) throw Error('ANTIMERIDIAN_UNSUPPORTED');
  const padding = 0.01 / Math.cos(Math.max(Math.abs(south), Math.abs(north)) * Math.PI / 180);
  const bounds = [west-padding,south-0.01,east+padding,north+0.01];
  if (bounds[0] < -180 || bounds[2] > 180 || bounds[1] <= -85 || bounds[3] >= 85)
    throw Error('REGION_UNSUPPORTED');
  return bounds;
}
module.exports = { readRoute, routeBounds };
