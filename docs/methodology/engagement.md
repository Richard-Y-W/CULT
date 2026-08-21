# Engagement methodology — CULT-BEHAVIOR-1

Engagement is behavior around expression-bearing content; it is not expression prevalence. CULT stores incremental like, repost, quote, and reply flows. A cumulative counter moving from 100 to 310 contributes 210, not 310.

Component flows remain official research inputs. The experimental composite is

```text
EF = wL log(1+Δlikes) + wR log(1+Δreposts)
   + wQ log(1+Δquotes) + wY log(1+Δreplies)
AM(t) = Σ EF_j exp(-ln(2) age_j / half_life)
```

Default simulation weights `(1,3,4,2)` and 15-minute half-life are scenario parameters, not empirical truths. Every result carries `CULT-BEHAVIOR-1`. Multi-expression posts support full and fractional attribution; neither choice changes document-presence prevalence.
