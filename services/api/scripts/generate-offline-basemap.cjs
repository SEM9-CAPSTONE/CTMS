// Run once or with --watch. Dedicated worker: requires Python + Pillow and shared private volumes.
require('dotenv/config');
const { Client } = require('pg');
const { readFile, mkdir, mkdtemp, rm } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { readRoute, routeBounds } = require('./offline-basemap-policy.cjs');
const MAX_ATTEMPTS = 3;
const DELAY_MS = 30000;
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
async function tick() {
  const db = new Client({connectionString:process.env.DATABASE_URL});
  await db.connect();
  let job;
  let work;
  try {
    // Session lock fences every worker, including while Python runs outside a DB transaction.
    const locked = (await db.query('SELECT pg_try_advisory_lock(308, 1) AS locked')).rows[0].locked;
    if (!locked) return;
    await db.query(`UPDATE offline_basemap_jobs SET status='FAILED',last_error='ATTEMPTS_EXHAUSTED',updated_at=now()
      WHERE status='GENERATING' AND attempts >= $1`, [MAX_ATTEMPTS]);
    await db.query(`UPDATE offline_basemap_jobs j SET status='READY',last_error=NULL,updated_at=now()
      FROM offline_basemaps b WHERE b.package_id=j.package_id AND j.status<>'READY'`);
    job = (await db.query(`UPDATE offline_basemap_jobs j SET status='GENERATING',attempts=attempts+1,updated_at=now()
      WHERE j.package_id=(SELECT candidate.package_id FROM offline_basemap_jobs candidate
        JOIN offline_packages p ON p.id=candidate.package_id JOIN trips t ON t.id=p.trip_id
        WHERE candidate.status IN ('PENDING','GENERATING') AND candidate.attempts<$1
          AND candidate.next_attempt_at<=now() AND t.status='published'
        ORDER BY candidate.updated_at,candidate.package_id LIMIT 1)
      RETURNING j.*`, [MAX_ATTEMPTS])).rows[0];
    if (!job) return;
    const core = (await db.query('SELECT * FROM offline_packages WHERE id=$1',[job.package_id])).rows[0];
    const archive = await readFile(resolve(process.env.OFFLINE_PACKAGE_STORAGE_ROOT || '.private-offline-packages',core.artifact_key));
    const bounds = routeBounds(readRoute(archive,core.sha256));
    const workRoot = resolve(process.env.OFFLINE_BASEMAP_WORK_ROOT || '.private-offline-basemap-work');
    await mkdir(workRoot,{recursive:true});
    work = await mkdtemp(join(workRoot,'render-'));
    const output = join(work,'tiles.mbtiles');
    const renderer = resolve(__dirname,'../../../scripts/build_osm_raster.py');
    execFileSync(process.env.OFFLINE_BASEMAP_PYTHON || 'python', [renderer,'--download','--source',join(work,'source.json'),
      '--output',output,'--bounds',...bounds.map(String)], {timeout:480000,stdio:'pipe',maxBuffer:1024*1024});
    // The publisher revalidates core hash, coverage, tile diversity and immutable binding.
    execFileSync(process.execPath,[join(__dirname,'publish-offline-basemap.cjs'),core.trip_id,String(core.package_version),output],
      {timeout:120000,stdio:'pipe',maxBuffer:1024*1024});
    await db.query("UPDATE offline_basemap_jobs SET status='READY',last_error=NULL,updated_at=now() WHERE package_id=$1",[job.package_id]);
    console.info(JSON.stringify({event:'offline_basemap_ready',packageId:job.package_id}));
  } catch (error) {
    if (job) await db.query(`UPDATE offline_basemap_jobs SET status=CASE WHEN attempts >= $2 THEN 'FAILED' ELSE 'PENDING' END,
      next_attempt_at=now()+interval '5 minutes',last_error='BASEMAP_GENERATION_FAILED',updated_at=now() WHERE package_id=$1`,[job.package_id,MAX_ATTEMPTS]);
    console.error(JSON.stringify({event:'offline_basemap_failed',packageId:job?.package_id,code:'BASEMAP_GENERATION_FAILED'}));
    if (!process.argv.includes('--watch')) throw error;
  } finally {
    if (work) await rm(work,{recursive:true,force:true});
    await db.end(); // releases the session advisory lock, also on failure
  }
}
async function main() {
  do {
    await tick();
    if (!process.argv.includes('--watch') || stopping) break;
    await new Promise(resolve => setTimeout(resolve,DELAY_MS));
  } while (!stopping);
}
main().catch(() => { process.exitCode=1; });
