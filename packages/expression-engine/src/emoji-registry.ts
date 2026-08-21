export interface EmojiRegistryAsset {
  numeric_id: number;
  id: string;
  ticker: string;
  canonical: string;
  variant_aggregation:
    | "EXACT"
    | "STRIP_VARIATION_SELECTOR"
    | "AGGREGATE_SKIN_TONES";
  variants: {
    utf8: string;
    codepoints: string;
    qualification: string;
    unicode_name: string;
  }[];
}
export interface EmojiRegistryData {
  registry_version: string;
  unicode_version: string;
  emoji_version: string;
  methodology_version: string;
  assets: EmojiRegistryAsset[];
}
export interface EmojiMatch {
  expressionId: string;
  numericId: number;
  occurrences: number;
  rawForms: string[];
}
export class EmojiRegistry {
  private readonly sequences: { raw: string; asset: EmojiRegistryAsset }[];
  constructor(readonly data: EmojiRegistryData) {
    this.sequences = data.assets
      .flatMap((asset) =>
        asset.variants.map((variant) => ({ raw: variant.utf8, asset })),
      )
      .sort((a, b) => b.raw.length - a.raw.length);
  }
  extract(text: string): EmojiMatch[] {
    const matches = new Map<string, EmojiMatch>();
    for (let offset = 0; offset < text.length; ) {
      const candidate = this.sequences.find((sequence) =>
        text.startsWith(sequence.raw, offset),
      );
      if (candidate) {
        const current = matches.get(candidate.asset.id) ?? {
          expressionId: candidate.asset.id,
          numericId: candidate.asset.numeric_id,
          occurrences: 0,
          rawForms: [],
        };
        current.occurrences++;
        current.rawForms.push(candidate.raw);
        matches.set(candidate.asset.id, current);
        offset += candidate.raw.length;
      } else {
        const codepoint = text.codePointAt(offset);
        offset += codepoint !== undefined && codepoint > 0xffff ? 2 : 1;
      }
    }
    return [...matches.values()].sort((a, b) => a.numericId - b.numericId);
  }
  documentPresence(text: string) {
    return this.extract(text).map((match) => match.expressionId);
  }
}
