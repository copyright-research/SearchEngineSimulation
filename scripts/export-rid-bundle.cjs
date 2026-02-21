#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

function printUsage() {
  console.log(
    [
      'Usage:',
      '  node scripts/export-rid-bundle.cjs --rid <RID> [--out <DIR>] [--skip-r2]',
      '',
      'Options:',
      '  --rid <RID>     Required. Target recording id',
      '  --out <DIR>     Optional. Output directory (default: exports/bundle-rid-<RID>-<timestamp>)',
      '  --skip-r2       Optional. Export SQL only, skip R2 download',
      '  --help, -h      Show help',
    ].join('\n')
  );
}

function sanitizeForPath(input) {
  return String(input).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'rid';
}

function parseArgs(argv) {
  const args = {
    rid: null,
    outDir: null,
    skipR2: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--rid') {
      args.rid = argv[++i];
    } else if (a === '--out') {
      args.outDir = argv[++i];
    } else if (a === '--skip-r2') {
      args.skipR2 = true;
    } else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  if (!args.rid) {
    throw new Error('Missing required --rid');
  }

  if (!args.outDir) {
    const safeRid = sanitizeForPath(args.rid);
    args.outDir = path.join('exports', `bundle-rid-${safeRid}-${Date.now()}`);
  }

  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function bigintReplacer(_key, value) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, bigintReplacer, 2), 'utf8');
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

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getRequiredR2Config(env) {
  const endpoint = env.R2_ENDPOINT;
  const bucket = env.R2_BUCKET;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing R2 env vars: R2_ENDPOINT/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY (or pass --skip-r2)'
    );
  }

  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

async function exportSqlRecordsByRid(prisma, rid, outDir) {
  const sqlDir = path.join(outDir, 'sql');
  ensureDir(sqlDir);

  const session = await prisma.searchSession.findUnique({
    where: { rid },
  });

  const sessionId = session?.id ?? null;

  const [searchHistoryRows, verificationQuestionRows, userAnswerRows] = sessionId
    ? await Promise.all([
        prisma.searchHistory.findMany({
          where: { sessionId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.verificationQuestion.findMany({
          where: { sessionId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.userAnswer.findMany({
          where: { sessionId },
          orderBy: { answeredAt: 'asc' },
          include: {
            question: {
              select: {
                question: true,
                correctAnswer: true,
              },
            },
          },
        }),
      ])
    : [[], [], []];

  const tablePayloads = [
    {
      table: 'search_sessions',
      file: path.join('sql', 'search_sessions.json'),
      rows: session ? [session] : [],
      filter: { rid },
    },
    {
      table: 'search_history',
      file: path.join('sql', 'search_history.json'),
      rows: searchHistoryRows,
      filter: { sessionId },
    },
    {
      table: 'verification_questions',
      file: path.join('sql', 'verification_questions.json'),
      rows: verificationQuestionRows,
      filter: { sessionId },
    },
    {
      table: 'user_answers',
      file: path.join('sql', 'user_answers.json'),
      rows: userAnswerRows,
      filter: { sessionId },
    },
  ];

  for (const payload of tablePayloads) {
    writeJson(path.join(outDir, payload.file), {
      table: payload.table,
      rid,
      sessionId,
      filter: payload.filter,
      rowCount: payload.rows.length,
      rows: payload.rows,
    });
    console.log(`[SQL] ${payload.table}: ${payload.rows.length} rows`);
  }

  const tableSummaries = tablePayloads.map((p) => ({
    table: p.table,
    rowCount: p.rows.length,
    file: p.file,
    filter: p.filter,
  }));

  return {
    rid,
    sessionId,
    missingSession: !session,
    tableSummaries,
    totalRows: tableSummaries.reduce((sum, t) => sum + t.rowCount, 0),
  };
}

async function exportR2RecordsByRid(rid, outDir, env) {
  const r2Dir = path.join(outDir, 'r2');
  ensureDir(r2Dir);

  const { endpoint, bucket, accessKeyId, secretAccessKey } = getRequiredR2Config(env);

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const prefix = `recordings/${rid}/`;
  const matched = [];
  let continuationToken;
  let scannedObjects = 0;

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      })
    );

    const contents = list.Contents || [];
    scannedObjects += contents.length;

    for (const item of contents) {
      if (!item.Key) continue;
      matched.push({
        key: item.Key,
        size: item.Size || 0,
        lastModified: item.LastModified ? item.LastModified.toISOString() : null,
      });
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`[R2] scanned objects under ${prefix}: ${scannedObjects}, matched: ${matched.length}`);

  let totalBytesDownloaded = 0;
  for (let i = 0; i < matched.length; i++) {
    const m = matched[i];
    const obj = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: m.key,
      })
    );

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
    rid,
    prefix,
    scannedObjects,
    matchedObjects: matched.length,
    totalBytesDownloaded,
    objects: matched,
  });

  return {
    rid,
    prefix,
    scannedObjects,
    matchedObjects: matched.length,
    totalBytesDownloaded,
    indexFile: path.join('r2', 'index.json'),
  };
}

async function main() {
  const { rid, outDir, skipR2 } = parseArgs(process.argv);
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
    console.log(`[START] rid=${rid}`);
    console.log(`[OUT] ${outAbs}`);

    const sqlSummary = await exportSqlRecordsByRid(prisma, rid, outAbs);
    const r2Summary = skipR2
      ? {
          skipped: true,
          reason: 'skip_r2_flag',
          matchedObjects: 0,
          scannedObjects: 0,
          totalBytesDownloaded: 0,
        }
      : await exportR2RecordsByRid(rid, outAbs, mergedEnv);

    const manifest = {
      rid,
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
        `Bundle RID: ${rid}`,
        `Generated At: ${manifest.finishedAt}`,
        '',
        `SQL rows exported: ${sqlSummary.totalRows}`,
        `SQL tables exported: ${sqlSummary.tableSummaries.length}`,
        `R2 objects matched: ${r2Summary.matchedObjects}`,
        `R2 objects scanned: ${r2Summary.scannedObjects}`,
        `R2 bytes downloaded: ${r2Summary.totalBytesDownloaded}`,
        `R2 skipped: ${Boolean(r2Summary.skipped)}`,
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

