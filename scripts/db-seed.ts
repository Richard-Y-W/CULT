import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
  // The live worker aggregates every expression in the pinned Unicode
  // registry (30 emoji), not just the ones @cult/shared lists as tradeable
  // ASSETS (19, a strict subset -- some registry emoji have no market
  // listing yet). expression_observations_v3.expression_id has a foreign
  // key against this table, so seeding only ASSETS left every window's
  // insert for a non-listed registry emoji failing with a foreign-key
  // violation -- found running this project's first real live-shadow
  // session. Seed the full registry first (ON CONFLICT DO NOTHING so it
  // never overrides richer product data), then let the ASSETS loop below
  // upsert the tradeable subset's ticker/description/etc as before.
  const registry = JSON.parse(
    await readFile(
      resolve("data/reference/unicode/cult-emoji-registry-v1.json"),
      "utf8",
    ),
  ) as {
    assets: {
      id: string;
      ticker: string;
      canonical: string;
      codepoints: string;
      display_name: string;
      unicode_name: string;
    }[];
  };
  for (const r of registry.assets)
    await db.query(
      "INSERT INTO expressions(id,ticker,canonical_expression,asset_type,unicode,display_name,description) VALUES($1,$2,$3,'EMOJI',$4,$5,$6) ON CONFLICT(id) DO NOTHING",
      [r.id, r.ticker, r.canonical, r.codepoints, r.display_name, r.unicode_name],
    );
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
