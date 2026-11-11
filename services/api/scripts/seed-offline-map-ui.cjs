// Local-only UI fixture. Does not run the master seed or modify existing trips.
const { Client } = require('pg');
const { zipSync } = require('fflate');
const { createHash, randomUUID } = require('node:crypto');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const tripId = '30800000-0000-4000-8000-000000000001';
const canonical = value => JSON.stringify(order(value));
function order(v) {
  if (Array.isArray(v)) return v.map(order);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, order(v[k])]));
  return v;
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function main() {
  const db = new Client({connectionString: process.env.DATABASE_URL || 'postgresql://ctms:ctms@localhost:5432/ctms'});
  await db.connect();
  try {
    await db.query('BEGIN');
    const user = (await db.query("SELECT id FROM users WHERE email=$1", ['camper@ctms.local'])).rows[0];
    if (!user) throw Error('Camper account missing');
    const source = (await db.query('SELECT host_id,route_id FROM trips WHERE route_id IS NOT NULL LIMIT 1')).rows[0];
    if (!source) throw Error('No existing route');

    // 1. Ensure trip exists with meeting point at Bãi Bụt (Chùa Linh Ứng)
    await db.query(`INSERT INTO trips(id,host_id,route_id,title,description,trip_type,duration_nights,starts_at,ends_at,booking_deadline,capacity_min,capacity_max,price_per_person,status,cancellation_policy,meeting_point)
      SELECT $1,host_id,route_id,'[UI TEST CTMS-308] Sơn Trà - Bản đồ ngoại tuyến','Tuyến trekking khám phá rừng nguyên sinh Sơn Trà từ Bãi Bụt lên Đỉnh Bàn Cờ.','day_trip',0,now()+interval '1 day',now()+interval '2 days',now()+interval '12 hours',1,10,0,'published',cancellation_policy,ST_SetSRID(ST_MakePoint(108.2754,16.1002),4326)::geography
      FROM trips WHERE host_id=$2 AND route_id=$3 LIMIT 1 ON CONFLICT(id) DO NOTHING`, [tripId,source.host_id,source.route_id]);

    let booking = (await db.query('SELECT id FROM bookings WHERE trip_id=$1 AND user_id=$2',[tripId,user.id])).rows[0];
    if (!booking) booking = (await db.query(`INSERT INTO bookings(trip_id,user_id,num_people,status,payment_status,trip_starts_at_snapshot,trip_ends_at_snapshot,base_price,total_amount,cancellation_policy_snapshot)
      SELECT id,$2,1,'confirmed','paid',starts_at,ends_at,0,0,cancellation_policy FROM trips WHERE id=$1 RETURNING id`,[tripId,user.id])).rows[0];
    await db.query(`INSERT INTO booking_members(booking_id,user_id,is_primary,member_status) VALUES($1,$2,true,'registered') ON CONFLICT DO NOTHING`,[booking.id,user.id]);

    // 2. Realistic winding mountain trail across Sơn Trà ridges (18 points)
    const coords = [
      [108.2754, 16.1002], // 1. Bãi Bụt · Chùa Linh Ứng (Xuất phát - 80m)
      [108.2738, 16.1016],
      [108.2720, 16.1031],
      [108.2701, 16.1046], // Cửa rừng Sơn Trà
      [108.2678, 16.1060],
      [108.2655, 16.1075],
      [108.2635, 16.1090], // 2. Trạm Dừng Nghỉ Suối Om (260m)
      [108.2612, 16.1105],
      [108.2590, 16.1120],
      [108.2570, 16.1136], // Dốc Bằng Lăng
      [108.2552, 16.1152],
      [108.2536, 16.1170], // 3. Cây Đa Ngàn Năm Sơn Trà (420m)
      [108.2518, 16.1188],
      [108.2500, 16.1205],
      [108.2480, 16.1221], // Dốc Khỉ
      [108.2461, 16.1238],
      [108.2442, 16.1254],
      [108.2425, 16.1270], // 4. Đỉnh Bàn Cờ Sơn Trà (Đích đến - 696m)
    ];

    const checkpoints = [
      {
        id: '30800000-0000-4000-8000-000000000002',
        routeId: source.route_id,
        name: 'Bãi Bụt · Chùa Linh Ứng (Xuất phát, độ cao ↑80 m)',
        type: 'start',
        location: { type: 'Point', coordinates: [108.2754, 16.1002] },
        radiusMeters: 30,
        instructions: 'Tập trung tại cổng phụ Chùa Linh Ứng, kiểm tra trang bị trước khi xuất phát.'
      },
      {
        id: '30800000-0000-4000-8000-000000000003',
        routeId: source.route_id,
        name: 'Trạm Dừng Nghỉ Suối Om (độ cao ↑260 m)',
        type: 'rest',
        location: { type: 'Point', coordinates: [108.2635, 16.1090] },
        radiusMeters: 35,
        instructions: 'Điểm nghỉ chân ven rừng nguyên sinh, tiếp nước và kiểm tra quân số.'
      },
      {
        id: '30800000-0000-4000-8000-000000000004',
        routeId: source.route_id,
        name: 'Cây Đa Ngàn Năm Sơn Trà (độ cao ↑420 m)',
        type: 'camp',
        location: { type: 'Point', coordinates: [108.2536, 16.1170] },
        radiusMeters: 30,
        instructions: 'Cây đa di sản hơn 800 năm tuổi, trạm dừng quan sát Vọoc Chà Vá.'
      },
      {
        id: '30800000-0000-4000-8000-000000000005',
        routeId: source.route_id,
        name: 'Đỉnh Bàn Cờ Sơn Trà (Đích đến, độ cao ↑696 m)',
        type: 'end',
        location: { type: 'Point', coordinates: [108.2425, 16.1270] },
        radiusMeters: 40,
        instructions: 'Đỉnh cao nhất bán đảo Sơn Trà. Hoàn thành toàn tuyến leo núi.'
      }
    ];

    const payloads = {
      'route.geojson': {
        type: 'Feature',
        properties: { routeId: source.route_id, fingerprint: 'sontra-realistic-trail-v2' },
        geometry: { type: 'LineString', coordinates: coords }
      },
      'checkpoints.json': checkpoints,
      'waypoints.json': [],
      'hazards.geojson': { type: 'FeatureCollection', features: [] },
      'guidance.json': []
    };

    const encoded = Object.fromEntries(Object.entries(payloads).map(([k,v]) => [k, Buffer.from(canonical(v))]));
    const version = 2;
    const manifest = {
      schemaVersion: 1,
      tripId,
      packageVersion: version,
      fixture: 'Sơn Trà Peninsula Trekking Route',
      files: Object.entries(encoded).map(([path, bytes]) => ({ path, sha256: hash(bytes), sizeBytes: bytes.length }))
    };

    const bytes = Buffer.from(zipSync({ 'manifest.json': Buffer.from(canonical(manifest)), ...encoded }, { level: 0, mtime: new Date(1980, 0, 1) }));
    const sha = hash(bytes);
    const root = resolve(process.env.OFFLINE_PACKAGE_STORAGE_ROOT || '.private-offline-packages');
    await mkdir(root, { recursive: true });
    await writeFile(resolve(root, sha + '.zip'), bytes);

    await db.query(`INSERT INTO offline_packages(id,trip_id,package_version,generation_key,schema_version,manifest,provenance,sha256,size_bytes,artifact_key,generated_at)
      VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) ON CONFLICT(trip_id,package_version) DO NOTHING`, [
      randomUUID(),
      tripId,
      version,
      hash('ctms-308-sontra-v2'),
      manifest,
      { fixture: true, purpose: 'Realistic Sơn Trà Mountain Trekking' },
      sha,
      bytes.length,
      sha + '.zip'
    ]);

    await db.query('COMMIT');
    console.log(JSON.stringify({ tripId, bookingId: booking.id, packageVersion: version, points: coords.length, checkpoints: checkpoints.length, status: 'published', fixture: true }));
  } catch(e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    await db.end();
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
