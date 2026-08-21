import pg from "pg";
import {
  prevalenceFromCounts,
  standardizedPrevalence,
} from "@cult/research-engine";

const requestedDate = process.argv[2];
const previousUtcDate = new Date(Date.now() - 86_400_000)
  .toISOString()
  .slice(0, 10);
const closeDate = requestedDate ?? previousUtcDate,
  start = `${closeDate}T00:00:00.000Z`,
  end = new Date(Date.parse(start) + 86_400_000).toISOString(),
  allowPartial = process.env.CULT_ALLOW_PARTIAL_CLOSE === "1";
const db = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://cult:cult@localhost:5432/cult",
});
await db.connect();
try {
  const windows = await db.query<{ count: string }>(
    `SELECT COUNT(DISTINCT window_start)::text AS count
     FROM expression_observations_v3
     WHERE language_bucket='ALL' AND window_start >= $1 AND window_start < $2`,
    [start, end],
  );
  const observedWindows = Number(windows.rows[0]?.count ?? 0);
  if (observedWindows !== 1440 && !allowPartial)
    throw new Error(
      `Official close requires 1440 UTC minute windows; observed ${observedWindows}. Set CULT_ALLOW_PARTIAL_CLOSE=1 only for a non-final research close.`,
    );
  const existing = await db.query(
    `SELECT 1 FROM official_expression_closes WHERE close_date=$1 AND is_final LIMIT 1`,
    [closeDate],
  );
  if (existing.rowCount)
    throw new Error("A final close already exists; use the revision workflow");
  const calibrationResult = await db.query<{
    id: string;
    content_weights: Record<string, number>;
    language_weights: Record<string, number>;
  }>(
    `SELECT id,content_weights,language_weights FROM standardization_calibrations
     WHERE status='ACTIVE' AND calibration_end <= $1 ORDER BY calibration_end DESC LIMIT 1`,
    [start],
  );
  const calibration = calibrationResult.rows[0];
  const rows = await db.query<{
    expression_id: string;
    content_bucket: "ORIGINAL" | "REPLY" | "QUOTE";
    language_bucket: string;
    eligible: string;
    expressed: string;
    occurrences: string;
  }>(
    `SELECT expression_id,content_bucket,language_bucket,
       SUM(eligible_documents)::text AS eligible,
       SUM(expression_documents)::text AS expressed,
       SUM(occurrence_count)::text AS occurrences
     FROM expression_observations_v3
     WHERE window_start >= $1 AND window_start < $2
     GROUP BY expression_id,content_bucket,language_bucket
     ORDER BY expression_id,content_bucket,language_bucket`,
    [start, end],
  );
  const ids = [...new Set(rows.rows.map((row) => row.expression_id))];
  await db.query("BEGIN");
  for (const expressionId of ids) {
    const expressionRows = rows.rows.filter(
        (row) => row.expression_id === expressionId,
      ),
      rawRows = expressionRows.filter((row) => row.language_bucket === "ALL"),
      eligible = rawRows.reduce((sum, row) => sum + Number(row.eligible), 0),
      expressed = rawRows.reduce((sum, row) => sum + Number(row.expressed), 0),
      occurrences = rawRows.reduce(
        (sum, row) => sum + Number(row.occurrences),
        0,
      ),
      raw = prevalenceFromCounts(expressed, eligible, occurrences),
      contentAdjusted = calibration
        ? standardizedPrevalence(
            rawRows.map((row) => ({
              key: row.content_bucket,
              expressionDocuments: Number(row.expressed),
              eligibleDocuments: Number(row.eligible),
            })),
            calibration.content_weights,
          )
        : null,
      languageAggregates = new Map<
        string,
        { expressionDocuments: number; eligibleDocuments: number }
      >();
    for (const row of expressionRows.filter(
      (item) => item.language_bucket !== "ALL",
    )) {
      const state = languageAggregates.get(row.language_bucket) ?? {
        expressionDocuments: 0,
        eligibleDocuments: 0,
      };
      state.expressionDocuments += Number(row.expressed);
      state.eligibleDocuments += Number(row.eligible);
      languageAggregates.set(row.language_bucket, state);
    }
    const languageAdjusted = calibration
        ? standardizedPrevalence(
            [...languageAggregates].map(([key, value]) => ({ key, ...value })),
            calibration.language_weights,
          )
        : null,
      previous = await db.query<{
        index_value: string;
        smoothed_prevalence: string;
      }>(
        `SELECT index_value::text,smoothed_prevalence::text FROM official_expression_closes
         WHERE expression_id=$1 AND close_date<$2 ORDER BY close_date DESC,revision_number DESC LIMIT 1`,
        [expressionId, closeDate],
      ),
      prior = previous.rows[0],
      indexValue = prior
        ? Number(prior.index_value) *
          (raw.smoothedPerMillion / Number(prior.smoothed_prevalence))
        : 1000;
    await db.query(
      `INSERT INTO official_expression_closes(expression_id,close_date,raw_eligible_documents,raw_expression_documents,raw_prevalence,smoothed_prevalence,content_adjusted_prevalence,language_adjusted_prevalence,fully_adjusted_prevalence,index_value,finalized_at,is_final,methodology_version,source_version,expression_registry_version,calibration_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,now(),$10,'REF-JEFFREYS-1','BLUESKY-JETSTREAM-1','EMOJI-17.0-CULT-V1',$11)`,
      [
        expressionId,
        closeDate,
        eligible,
        expressed,
        raw.rawPerMillion,
        raw.smoothedPerMillion,
        contentAdjusted?.perMillion ?? null,
        languageAdjusted?.perMillion ?? null,
        indexValue,
        observedWindows === 1440,
        calibration?.id ?? null,
      ],
    );
  }
  await db.query("COMMIT");
  console.log(
    JSON.stringify({
      closeDate,
      observedWindows,
      expressions: ids.length,
      isFinal: observedWindows === 1440,
      calibrationId: calibration?.id ?? null,
    }),
  );
} catch (error) {
  await db.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await db.end();
}
