// Operator command: bind an independently validated raster to an immutable core package.
// Usage (services/api cwd): node scripts/publish-offline-basemap.cjs TRIP_UUID VERSION FILE
require('dotenv/config');
const { Client } = require('pg');
const { readMapPoints, routeBounds, assertCoverage } = require('./offline-basemap-policy.cjs');
const { readFile, mkdir, copyFile, stat, link, rm } = require('node:fs/promises');
const { constants } = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const digest = b => createHash('sha256').update(b).digest('hex');
async function main() {
  const [trip, rawVersion, fileArg] = process.argv.slice(2);
  const version = Number(rawVersion);
  if (!/^[a-f0-9-]{36}$/i.test(trip || '') || !Number.isSafeInteger(version) || version<1 || !fileArg)
    throw Error('Usage: TRIP_UUID VERSION MBTILES_FILE');
  const file = resolve(fileArg);
  if ((await stat(file)).size > 104857600) throw Error('Basemap exceeds 100 MiB');
  const metadata = JSON.parse(execFileSync(process.env.OFFLINE_BASEMAP_PYTHON || 'python',['-c',
    'import sqlite3,json,sys; c=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True); print(json.dumps(dict(c.execute("select name,value from metadata")))); c.close()',file],{encoding:'utf8'}));
  if (metadata.format!=='png' || metadata.minzoom!=='12' || metadata.maxzoom!=='16' ||
      metadata.attribution!=='© OpenStreetMap contributors' ||
      metadata.license!=='https://www.openstreetmap.org/copyright') throw Error('Unsupported format or missing source license');
  const bounds=metadata.bounds.split(',').map(Number);
  const validation=JSON.parse(execFileSync(process.env.OFFLINE_BASEMAP_PYTHON || 'python',[resolve(__dirname,'../../../scripts/build_osm_raster.py'),
    '--validate','--output',file,'--bounds',...bounds.map(String)],{encoding:'utf8'}));
  const bytes=await readFile(file);
  const sha=digest(bytes);
  if(sha!==validation.sha256) throw Error('File changed during validation');
  const db=new Client({connectionString:process.env.DATABASE_URL || 'postgresql://ctms:ctms@localhost:5432/ctms'});
  await db.connect();
  try {
    const row=(await db.query('SELECT * FROM offline_packages WHERE trip_id=$1 AND package_version=$2',[trip,version])).rows[0];
    if(!row) throw Error('Core package missing');
    const archive=await readFile(resolve(process.env.OFFLINE_PACKAGE_STORAGE_ROOT || '.private-offline-packages',row.artifact_key));
    const points=readMapPoints(archive,row.sha256);
    const required=routeBounds(points,Number(process.env.OFFLINE_BASEMAP_BUFFER_METERS || 1500));
    assertCoverage(bounds,points);
    assertCoverage(bounds,[[required[0],required[1]],[required[2],required[3]]]);
    const root=resolve(process.env.OFFLINE_BASEMAP_STORAGE_ROOT || '.private-offline-basemaps');
    await mkdir(root,{recursive:true});
    const dest=resolve(root,sha+'.mbtiles');
    const staged=resolve(root,`${sha}.${randomUUID()}.partial`);
    try {
      await copyFile(file,staged,constants.COPYFILE_EXCL);
      if(digest(await readFile(staged))!==sha) throw Error('Copied artifact is not intact');
      // A hard link publishes a complete file atomically without replacing an immutable binding.
      try { await link(staged,dest); }
      catch(e) { if(e.code!=='EEXIST') throw e; }
    } finally { await rm(staged,{force:true}); }
    if(digest(await readFile(dest))!==sha) throw Error('Stored artifact is not intact');
    await db.query('BEGIN');
    const tripStatus=(await db.query('SELECT status FROM trips WHERE id=$1 FOR SHARE',[trip])).rows[0]?.status;
    if(tripStatus!=='published') throw Error('Trip must still be published before binding a new basemap');
    await db.query(`INSERT INTO offline_basemaps(package_id,sha256,size_bytes,bounds,min_zoom,max_zoom,attribution,license_url)
      VALUES($1,$2,$3,$4,12,16,$5,$6) ON CONFLICT(package_id) DO NOTHING`,
      [row.id,sha,bytes.length,JSON.stringify(bounds),metadata.attribution,metadata.license]);
    const stored=(await db.query('SELECT sha256 FROM offline_basemaps WHERE package_id=$1',[row.id])).rows[0];
    if(stored.sha256!==sha) throw Error('This package is already pinned to a different basemap; publish a new core version');
    await db.query('COMMIT');
    console.log(JSON.stringify({tripId:trip,packageVersion:version,packageId:row.id,sha256:sha,sizeBytes:bytes.length,tiles:validation.tiles}));
  } catch(error) { await db.query('ROLLBACK'); throw error; } finally { await db.end(); }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
