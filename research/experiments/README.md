# CULT experiment registry

Each registry entry is a reproducible research question, not a claim of a result. Run `python research/run_experiment.py EXPERIMENT_ID DATASET_DIR OUTPUT_JSON`. The runner records the dataset manifest hash, Git commit, parameters, dependency versions, seed, metrics, interpretation status, and limitations. It reports missing schema/history instead of inventing output.

Experiments refuse to publish inferential conclusions when the input contains fewer than seven complete UTC days. Thirty days is the preferred threshold.
