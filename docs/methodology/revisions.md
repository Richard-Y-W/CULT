# Official-close revisions

Final daily closes are append-only. A correction creates a revision record containing the original value, revised value, sequential revision number, reason, timestamp, and the exact methodology/source/registry versions. It does not overwrite prior history.

Allowed reasons include recovered source outage, duplicate-event correction, parsing defect, and documented methodology correction. A methodology change normally creates a new series; a revision is not a mechanism for retroactively making output aesthetically preferable. API consumers can reconstruct the originally published and latest corrected values.
