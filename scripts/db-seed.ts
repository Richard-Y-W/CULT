import pg from "pg";
import { randomUUID } from "node:crypto";
import { ASSETS } from "@cult/shared";
import { INDEXES } from "@cult/index-engine";
const db = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://cult:cult@localhost:5432/cult",
});
await db.connect();
try {
  await db.query("BEGIN");
  for (const a of ASSETS)
    await db.query(
      "INSERT INTO expressions(id,ticker,canonical_expression,asset_type,unicode,display_name,description) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name",
      [
        a.id,
        a.ticker,
        a.canonicalExpression,
        a.assetType,
        a.unicode ?? null,
        a.displayName,
        a.description,
      ],
    );
  for (const x of INDEXES) {
    await db.query(
      "INSERT INTO indexes(id,ticker,name,description,methodology,weighting,rebalance_frequency) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING",
      [
        x.id,
        x.ticker,
        x.name,
        x.description,
        x.methodology,
        x.weighting,
        x.rebalanceFrequency,
      ],
    );
    for (const c of x.constituents)
      await db.query(
        "INSERT INTO index_constituents(index_id,effective_at,asset_id,weight) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [x.id, "2026-01-01", c.assetId, c.weight],
      );
  }
  const userId = randomUUID(),
    accountId = randomUUID();
  await db.query(
    "INSERT INTO users(id,username,email,subscription_tier) VALUES($1,'cryingcapital','demo@cult.local','ANALYST') ON CONFLICT(email) DO NOTHING",
    [userId],
  );
  const row = await db.query(
    "SELECT id FROM users WHERE email='demo@cult.local'",
  );
  await db.query(
    "INSERT INTO accounts(id,user_id,current_balance_minor) VALUES($1,$2,1000000) ON CONFLICT(user_id) DO NOTHING",
    [accountId, row.rows[0].id],
  );
  const account = await db.query("SELECT id FROM accounts WHERE user_id=$1", [
    row.rows[0].id,
  ]);
  await db.query(
    "INSERT INTO ledger_entries(id,account_id,type,amount_minor) SELECT $1,$2,'INITIAL_GRANT',1000000 WHERE NOT EXISTS(SELECT 1 FROM ledger_entries WHERE account_id=$2)",
    [randomUUID(), account.rows[0].id],
  );
  await db.query("COMMIT");
  console.log(
    `Seeded ${ASSETS.length} expressions, ${INDEXES.length} indexes, and the local Analyst account.`,
  );
} catch (e) {
  await db.query("ROLLBACK");
  throw e;
} finally {
  await db.end();
}
