# Semantic layer

Usage is not sentiment. The objective layer counts eligible documents containing a canonical expression and is the only input to the Expression Index oracle. The semantic layer estimates context-dependent label probabilities such as humor, sadness, irony, affection, hype, and pessimism. It is analytical and can never alter settlement.

V0 generates normalized semantic vectors synthetically, including gradual drift for `😭`. Later classifiers must be versioned, calibrated, evaluated by language/context, and retain uncertainty. No demographic inference is supported.

Normalized semantic entropy is `-Σ p(k) ln p(k) / ln K`, ranging from zero for concentrated meaning to one for distributed meaning. A methodology/model update produces a new analytical series rather than rewriting the objective usage history.
