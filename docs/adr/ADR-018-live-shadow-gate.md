# ADR-018 — Live shadow before live market

Status: accepted, 2026-08-21.

Live source connection does not activate market-driving behavior. `live-shadow` is explicit and `live-market` requires acknowledgement plus at least 72 recorded validation hours (seven days preferred). This gate is defense in depth, not automatic methodological approval.
