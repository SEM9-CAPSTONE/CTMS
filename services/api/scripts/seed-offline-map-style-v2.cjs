// Separate local demo: never replace a basemap pinned by an ongoing Trip.
require('dotenv/config');
const {Client}=require('pg');
const {readFile,mkdir,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {zipSync,unzipSync}=require('fflate');
const hash=b=>createHash('sha256').update(b).digest('hex');
const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
const canonical=v=>JSON.stringify(ordered(v));
async function main(){
  const db=new Client({connectionString:process.env.DATABASE_URL||'postgresql://ctms:ctms@localhost:5432/ctms'});
  await db.connect();
  const trip='30800000-0000-4000-8000-000000000002';
  try{
    await db.query('BEGIN');
    const old=(await db.query('SELECT * FROM offline_packages WHERE trip_id=$1 AND package_version=2',['30800000-0000-4000-8000-000000000001'])).rows[0];
    if(!old) throw Error('Original demo v2 missing');
    const root=resolve(process.env.OFFLINE_PACKAGE_STORAGE_ROOT||'.private-offline-packages');
    const source=await readFile(resolve(root,old.artifact_key));
    if(hash(source)!==old.sha256) throw Error('Source checksum mismatch');
    const entries=unzipSync(source);
    const manifest=JSON.parse(Buffer.from(entries['manifest.json']).toString('utf8'));
    manifest.tripId=trip;manifest.packageVersion=1;
    entries['manifest.json']=Buffer.from(canonical(manifest));
    const bytes=Buffer.from(zipSync(entries,{level:0,mtime:new Date(1980,0,1)}));
    const sha=hash(bytes);
    await mkdir(root,{recursive:true});await writeFile(resolve(root,sha+'.zip'),bytes);
    await db.query(`INSERT INTO trips(id,host_id,route_id,title,description,trip_type,duration_nights,starts_at,ends_at,booking_deadline,capacity_min,capacity_max,price_per_person,status,cancellation_policy,meeting_point)
      SELECT $1,host_id,route_id,'[UI TEST CTMS-308] Sơn Trà - Nền mới','Fixture kiểm thử bản đồ, không dùng dẫn đường thực tế.','day_trip',0,now()+interval '1 day',now()+interval '2 days',now()+interval '12 hours',1,10,0,'published',cancellation_policy,meeting_point
      FROM trips WHERE id=$2 ON CONFLICT(id) DO NOTHING`,[trip,old.trip_id]);
    const user=(await db.query("SELECT id FROM users WHERE email='camper@ctms.local'")).rows[0];
    let booking=(await db.query('SELECT id FROM bookings WHERE trip_id=$1 AND user_id=$2',[trip,user.id])).rows[0];
    if(!booking) booking=(await db.query(`INSERT INTO bookings(trip_id,user_id,num_people,status,payment_status,trip_starts_at_snapshot,trip_ends_at_snapshot,base_price,total_amount,cancellation_policy_snapshot)
      SELECT id,$2,1,'confirmed','paid',starts_at,ends_at,0,0,cancellation_policy FROM trips WHERE id=$1 RETURNING id`,[trip,user.id])).rows[0];
    await db.query("INSERT INTO booking_members(booking_id,user_id,is_primary,member_status) VALUES($1,$2,true,'registered') ON CONFLICT DO NOTHING",[booking.id,user.id]);
    await db.query(`INSERT INTO offline_packages(id,trip_id,package_version,generation_key,schema_version,manifest,provenance,sha256,size_bytes,artifact_key,generated_at)
      VALUES($1,$2,1,$3,1,$4,$5,$6,$7,$8,now()) ON CONFLICT(trip_id,package_version) DO NOTHING`,
      [randomUUID(),trip,hash('ctms-style-v2-separate-demo'),manifest,{fixture:true,purpose:'New OSM style preview'},sha,bytes.length,sha+'.zip']);
    await db.query('COMMIT');console.log(JSON.stringify({tripId:trip,title:'[UI TEST CTMS-308] Sơn Trà - Nền mới'}));
  }catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
