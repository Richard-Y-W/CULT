# Unicode normalization — EMOJI-17.0-CULT-1

CULT pins stable Unicode Emoji 17.0. The registry generator verifies SHA-256 hashes for the official `emoji-test.txt`, `emoji-sequences.txt`, and `emoji-zwj-sequences.txt` inputs before generating `cult-emoji-registry-v1.json`. Updates are explicit methodology changes; files never silently follow a draft or “latest” URL.

## Matching policy

Emoji are sequence objects, not bytes or individual code points. Detection performs deterministic longest-sequence matching against registered forms. This preserves ZWJ families, gender sequences, flags, keycaps, modifiers, and combining sequences. Invalid UTF-8 must not crash the extractor.

- `❤` and `❤️` aggregate into the generic HEART asset; the observed raw form remains available within the transient/window aggregate path.
- Skin-tone variants aggregate to the broad traded expression when the registry entry says `AGGREGATE_SKIN_TONES`; raw variant counts are not semantically discarded.
- Semantically different ZWJ sequences and country flags remain distinct.
- Repetition such as `😭😭😭` adds one expression-document count and three occurrences.
- No general Unicode normalization is applied that could merge distinct expression sequences accidentally.

`config/expression-universe-v1.json` is the reviewed 30-asset universe. The generated registry recognizes 51 raw sequences. Official Unicode sources and checksums are stored under `data/reference/unicode/` under the Unicode Data Files and Software License.
