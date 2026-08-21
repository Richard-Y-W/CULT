import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
type UniverseAsset = {
  numeric_id: number;
  id: string;
  ticker: string;
  canonical: string;
  codepoints: string;
  unicode_name: string;
  display_name: string;
  category: string;
  variant_aggregation:
    | "EXACT"
    | "STRIP_VARIATION_SELECTOR"
    | "AGGREGATE_SKIN_TONES";
};
type Universe = {
  registry_version: string;
  unicode_version: string;
  emoji_version: string;
  methodology_version: string;
  active_from: string;
  assets: UniverseAsset[];
};
type Manifest = { sources: { file: string; sha256: string }[] };
const base = "data/reference/unicode",
  manifest = JSON.parse(
    await readFile(`${base}/manifest.json`, "utf8"),
  ) as Manifest,
  universe = JSON.parse(
    await readFile("config/expression-universe-v1.json", "utf8"),
  ) as Universe;
for (const source of manifest.sources) {
  const bytes = await readFile(`${base}/${source.file}`),
    actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== source.sha256)
    throw new Error(`${source.file} checksum mismatch: ${actual}`);
}
const test = await readFile(`${base}/emoji-test.txt`, "utf8"),
  sequences: [string, string, string][] = [];
for (const line of test.split(/\r?\n/)) {
  const match = line.match(
    /^([0-9A-F ]+)\s*;\s*([^#]+)#\s*\S+\s+E[0-9.]+\s+(.+)$/,
  );
  if (match)
    sequences.push([match[1]!.trim(), match[2]!.trim(), match[3]!.trim()]);
}
const codepoints = (hex: string) =>
    hex
      .split(/\s+/)
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 16)),
  toUtf8 = (hex: string) => String.fromCodePoint(...codepoints(hex));
const stripVs = (hex: string) =>
    codepoints(hex)
      .filter((cp) => cp !== 0xfe0f)
      .map((cp) => cp.toString(16).toUpperCase())
      .join(" "),
  stripTones = (hex: string) =>
    codepoints(hex)
      .filter((cp) => cp !== 0xfe0f && (cp < 0x1f3fb || cp > 0x1f3ff))
      .map((cp) => cp.toString(16).toUpperCase())
      .join(" ");
const registry = {
  registry_version: universe.registry_version,
  unicode_version: universe.unicode_version,
  emoji_version: universe.emoji_version,
  methodology_version: universe.methodology_version,
  generated_at: "2026-08-21T00:00:00Z",
  assets: universe.assets.map((asset) => {
    const variants = sequences
      .filter(([hex]) =>
        asset.variant_aggregation === "EXACT"
          ? hex === asset.codepoints
          : asset.variant_aggregation === "STRIP_VARIATION_SELECTOR"
            ? stripVs(hex) === stripVs(asset.codepoints)
            : stripTones(hex) === stripTones(asset.codepoints),
      )
      .map(([hex, status, name]) => ({
        codepoints: hex,
        utf8: toUtf8(hex),
        qualification: status,
        unicode_name: name,
      }));
    if (!variants.some((v) => v.utf8 === asset.canonical))
      throw new Error(
        `${asset.id} canonical form not found in Emoji ${universe.emoji_version}`,
      );
    return { ...asset, variants };
  }),
};
await writeFile(
  `${base}/cult-emoji-registry-v1.json`,
  `${JSON.stringify(registry, null, 2)}\n`,
);
console.log(
  `Validated and generated ${registry.assets.length} assets with ${registry.assets.reduce((sum, a) => sum + a.variants.length, 0)} recognized sequences from Unicode Emoji ${universe.emoji_version}.`,
);
