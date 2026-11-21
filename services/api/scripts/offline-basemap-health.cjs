// Checks process liveness during async rendering and a separate database connection.
require('dotenv/config');
const { stat } = require('node:fs/promises');
const { Client } = require('pg');
async function main() {
  const heartbeat=(await stat(process.env.OFFLINE_BASEMAP_HEARTBEAT_FILE)).mtimeMs;
  const age=Date.now()-heartbeat;
  if (!Number.isFinite(age) || age<0 || age>60000) throw Error('WORKER_HEARTBEAT_STALE');
  const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:3000,query_timeout:3000});
  try { await db.connect(); await db.query('SELECT 1 FROM offline_basemap_jobs LIMIT 1'); }
  finally { await db.end(); }
}
main().catch(() => { process.exitCode=1; });
