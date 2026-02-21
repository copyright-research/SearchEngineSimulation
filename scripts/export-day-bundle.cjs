#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

function parseArgs(argv) {
  const args = {
    day: null,
    timezone: 'America/Los_Angeles',
    outDir: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--day') {
      args.day = argv[++i];
    } else if (a === '--timezone') {
      args.timezone = argv[++i];
    } else if (a === '--out') {
      args.outDir = argv[++i];
    }
  }

  if (!args.day || !/^\d{4}-\d{2}-\d{2}$/.test(args.day)) {
    throw new Error('Missing or invalid --day (expected YYYY-MM-DD)');
  }

  if (!args.outDir) {
    args.outDir = path.join('exports', `bundle-${args.day}-${Date.now()}`);
  }

  return args;
}

function addOneDay(dayStr) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, bigintReplacer, 2), 'utf8');
}

function bigintReplacer(_key, value) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function ymdInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  let year = '';
  let month = '';
  let day = '';
  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    if (p.type === 'month') month = p.value;
    if (p.type === 'day') day = p.value;
  }
  return `${year}-${month}-${day}`;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function exportSqlRecords(prisma, day, timezone, outDir) {
  const nextDay = addOneDay(day);
  const sqlDir = path.join(outDir, 'sql');
  ensureDir(sqlDir);

  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const tableSummaries = [];

  for (const row of tables) {
    const tableName = row.table_name;

    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${String(tableName).replace(/'/g, "''")}'
      ORDER BY ordinal_position
    `);

    const temporalColumns = columns.filter((c) => {
      return c.data_type === 'timestamp with time zone' ||
             c.data_type === 'timestamp without time zone' ||
             c.data_type === 'date';
    });

    if (temporalColumns.length === 0) {
      tableSummaries.push({
        table: tableName,
        exported: false,
        reason: 'no_temporal_column',
        rowCount: 0,
      });
      continue;
    }

    const whereParts = temporalColumns.map((c) => {
      const col = quoteIdent(c.column_name);
      if (c.data_type === 'timestamp with time zone') {
        return `(${col} AT TIME ZONE '${timezone.replace(/'/g, "''")}') >= '${day} 00:00:00'::timestamp AND (${col} AT TIME ZONE '${timezone.replace(/'/g, "''")}') < '${nextDay} 00:00:00'::timestamp`;
      }
      if (c.data_type === 'timestamp without time zone') {
        return `${col} >= '${day} 00:00:00'::timestamp AND ${col} < '${nextDay} 00:00:00'::timestamp`;
      }
      return `${col} >= '${day}'::date AND ${col} < '${nextDay}'::date`;
    });

    const whereClause = whereParts.join(' OR ');

    const dataQuery = `SELECT * FROM ${quoteIdent(tableName)} WHERE (${whereClause})`;
    const rows = await prisma.$queryRawUnsafe(dataQuery);

    writeJson(path.join(sqlDir, `${tableName}.json`), {
      table: tableName,
      day,
      timezone,
      temporalColumns,
      rowCount: rows.length,
      rows,
    });

    tableSummaries.push({
      table: tableName,
      exported: true,
      temporalColumns: temporalColumns.map((c) => ({ name: c.column_name, dataType: c.data_type })),
      rowCount: rows.length,
      file: path.join('sql', `${tableName}.json`),
    });

    console.log(`[SQL] ${tableName}: ${rows.length} rows`);
  }

  return {
    day,
    timezone,
    tableSummaries,
    totalTables: tableSummaries.length,
    totalRows: tableSummaries.reduce((sum, t) => sum + (t.rowCount || 0), 0),
  };
}

async function exportR2Records(day, timezone, outDir, env) {
  const r2Dir = path.join(outDir, 'r2');
  ensureDir(r2Dir);

  const endpoint = env.R2_ENDPOINT;
  const bucket = env.R2_BUCKET;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 env vars: R2_ENDPOINT/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY');
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const matched = [];
  let continuationToken;
  let scanned = 0;

  do {
    const list = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'recordings/',
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    }));

    const contents = list.Contents || [];
    scanned += contents.length;

    for (const item of contents) {
      if (!item.Key || !item.LastModified) continue;
      const ymd = ymdInTimezone(item.LastModified, timezone);
      if (ymd === day) {
        matched.push({
          key: item.Key,
          size: item.Size || 0,
          lastModified: item.LastModified.toISOString(),
        });
      }
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`[R2] scanned objects: ${scanned}, matched for ${day} (${timezone}): ${matched.length}`);

  let totalBytesDownloaded = 0;

  for (let i = 0; i < matched.length; i++) {
    const m = matched[i];
    const obj = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: m.key,
    }));

    if (!obj.Body) {
      throw new Error(`Empty body for key: ${m.key}`);
    }

    const body = await streamToBuffer(obj.Body);
    const outFile = path.join(r2Dir, m.key);
    ensureDir(path.dirname(outFile));
    fs.writeFileSync(outFile, body);
    totalBytesDownloaded += body.length;

    if ((i + 1) % 50 === 0 || i + 1 === matched.length) {
      console.log(`[R2] downloaded ${i + 1}/${matched.length}`);
    }
  }

  writeJson(path.join(r2Dir, 'index.json'), {
    day,
    timezone,
    scannedObjects: scanned,
    matchedObjects: matched.length,
    totalBytesDownloaded,
    objects: matched,
  });

  return {
    day,
    timezone,
    scannedObjects: scanned,
    matchedObjects: matched.length,
    totalBytesDownloaded,
    indexFile: path.join('r2', 'index.json'),
  };
}

function loadEnvFromFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function main() {
  const { day, timezone, outDir } = parseArgs(process.argv);
  const outAbs = path.resolve(outDir);
  ensureDir(outAbs);

  const envFromFile = loadEnvFromFile(path.join(process.cwd(), '.env'));
  const mergedEnv = { ...envFromFile, ...process.env };

  if (!mergedEnv.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment or .env');
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: mergedEnv.DATABASE_URL,
      },
    },
  });

  const startedAt = new Date().toISOString();
  try {
    console.log(`[START] day=${day}, timezone=${timezone}`);
    console.log(`[OUT] ${outAbs}`);

    const sqlSummary = await exportSqlRecords(prisma, day, timezone, outAbs);
    const r2Summary = await exportR2Records(day, timezone, outAbs, mergedEnv);

    const manifest = {
      day,
      timezone,
      startedAt,
      finishedAt: new Date().toISOString(),
      outputDir: outAbs,
      sql: sqlSummary,
      r2: r2Summary,
    };

    writeJson(path.join(outAbs, 'manifest.json'), manifest);
    fs.writeFileSync(
      path.join(outAbs, 'README.txt'),
      [
        `Bundle Day: ${day}`,
        `Timezone Filter: ${timezone}`,
        `Generated At: ${manifest.finishedAt}`,
        '',
        `SQL rows exported: ${sqlSummary.totalRows}`,
        `SQL tables scanned: ${sqlSummary.totalTables}`,
        `R2 objects matched: ${r2Summary.matchedObjects}`,
        `R2 objects scanned: ${r2Summary.scannedObjects}`,
        `R2 bytes downloaded: ${r2Summary.totalBytesDownloaded}`,
        '',
        'See manifest.json for full details.',
      ].join('\n'),
      'utf8'
    );

    console.log('[DONE] Export complete');
    console.log(`[MANIFEST] ${path.join(outAbs, 'manifest.json')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[ERROR]', err && err.stack ? err.stack : err);
  process.exit(1);
});
