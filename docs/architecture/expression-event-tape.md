# Expression event tape

The expression tape records source events before interpretation. Its logical key is `(source_id,event_id)` and its clocks are `event_time_ns` and `receive_time_ns`; neither is exchange time. A record carries an expression set, content/language bucket, privacy-safe cascade identifiers, engagement **deltas**, backfill state, and methodology/source/registry versions.

Posts containing several tracked expressions remain multi-label. `FULL` and `FRACTIONAL` engagement attribution are retained as research alternatives. Every expression receives document-presence credit for prevalence. Likes, reposts, quotes, and replies never create new prevalence documents.

Raw text, handles, profiles, and durable public actor identifiers are outside this tape. Event order is deterministic in replay; missing events are not zeros.
