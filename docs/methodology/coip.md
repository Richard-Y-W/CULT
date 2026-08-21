# CULT Observable Internet Panel (COIP-1)

COIP is a versioned sample of public online environments. It is not “the internet,” and CULT does not claim demographic representativeness. The Phase 2 empirical panel contains one source—public Bluesky textual posts observed through Jetstream—so every empirical index is labelled **PROVISIONAL: 1 SOURCE**.

## COIP-1 eligibility

An eligible document is a newly authored public `app.bsky.feed.post` record. Original posts, replies, and quote-post text are eligible and separately bucketed. Pure repost events are not new textual documents. Deleted records cannot retroactively become eligible. Collection uses UTC one-minute base windows, with deterministic 5-minute, hourly, and daily rollups planned from the base aggregates.

The denominator is eligible documents per source and content bucket. One document contributes at most one document-presence count per expression, regardless of repetition. Occurrence intensity is retained separately. Raw text and actor identifiers are transient; persistent data is aggregate-only.

## Source and weighting policy

COIP-1 assigns Bluesky an effective weight of 1 because it is the only live source. This is not a claim that Bluesky represents all public expression. Future sources require an explicit methodology version. Source weights will be published and will not depend on how many records CULT happened to collect.

## Failure, missingness, and revisions

Disconnected, stale, degraded, or backfilling sources mark affected windows. A missing source is not interpreted as zero usage. Official daily closes cover 00:00:00–23:59:59 UTC and are immutable except through the auditable revision policy. Every aggregate carries methodology, source, and expression-registry versions.

See [Bluesky source methodology](source-bluesky.md), [prevalence](prevalence.md), [reference index](reference-index.md), and [revisions](revisions.md).
