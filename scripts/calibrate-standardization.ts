import pg from "pg";

const [id, start, end] = process.argv.slice(2);
if (!id || !start || !end)
  throw new Error(
    "Usage: npm run calibrate:standardization -- CAL-ID START_ISO END_ISO",
  );
const startMs = Date.parse(start),
  endMs = Date.parse(end),
  days = (endMs - startMs) / 86_400_000;
if (!Number.isFinite(days) || days < 30)
  throw new Error(
    "STANDARDIZATION-1 requires a fixed calibration period >= 30 days",
  );
const db = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://cult:cult@localhost:5432/cult",
});
await db.connect();
try {
  const content = await db.query<{ key: string; eligible: string }>(
      `WITH denominators AS (
         SELECT DISTINCT platform_id,content_bucket,window_start,eligible_documents
         FROM expression_observations_v3
         WHERE language_bucket='ALL' AND window_start >= $1 AND window_start < $2
       )
       SELECT content_bucket AS key,SUM(eligible_documents)::text AS eligible
       FROM denominators GROUP BY content_bucket ORDER BY content_bucket`,
      [start, end],
    ),
    language = await db.query<{ key: string; eligible: string }>(
      `WITH denominators AS (
         SELECT DISTINCT platform_id,content_bucket,language_bucket,window_start,eligible_documents
         FROM expression_observations_v3
         WHERE language_bucket<>'ALL' AND window_start >= $1 AND window_start < $2
       )
       SELECT language_bucket AS key,SUM(eligible_documents)::text AS eligible
       FROM denominators GROUP BY language_bucket ORDER BY language_bucket`,
      [start, end],
    ),
    windowResult = await db.query<{ windows: string }>(
      `SELECT COUNT(DISTINCT window_start)::text AS windows
       FROM expression_observations_v3
       WHERE language_bucket='ALL' AND window_start >= $1 AND window_start < $2`,
      [start, end],
    ),
    expectedWindows = Math.floor(days * 1440),
    observedWindows = Number(windowResult.rows[0]?.windows ?? 0);
  if (observedWindows < expectedWindows * 0.95)
    throw new Error(
      `Calibration coverage ${observedWindows}/${expectedWindows} is below 95%`,
    );
  const normalize = (rows: { key: string; eligible: string }[]) => {
      const total = rows.reduce((sum, row) => sum + Number(row.eligible), 0);
      if (total <= 0) throw new Error("Calibration has no eligible documents");
      return Object.fromEntries(
        rows.map((row) => [row.key, Number(row.eligible) / total]),
      );
    },
    contentWeights = normalize(content.rows),
    languageWeights = normalize(language.rows);
  await db.query(
    `INSERT INTO standardization_calibrations(id,source_id,calibration_start,calibration_end,content_weights,language_weights,minimum_windows,status,methodology_version,expression_registry_version)
     VALUES($1,'BLUESKY',$2,$3,$4,$5,$6,'ACTIVE','STANDARDIZATION-1','EMOJI-17.0-CULT-V1')`,
    [id, start, end, contentWeights, languageWeights, expectedWindows],
  );
  console.log(
    JSON.stringify({
      id,
      start,
      end,
      observedWindows,
      contentWeights,
      languageWeights,
    }),
  );
} finally {
  await db.end();
}
