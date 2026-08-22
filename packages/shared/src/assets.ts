import type { ExpressionAsset } from "./index.js";
const createdAt = "2025-08-22T00:00:00.000Z";
const row = (
  id: string,
  ticker: string,
  canonicalExpression: string,
  displayName: string,
  currentIndexValue: number,
  dailyChange: number,
  assetType: ExpressionAsset["assetType"] = "EMOJI",
  confidence = 96,
): ExpressionAsset => ({
  id,
  ticker,
  canonicalExpression,
  displayName,
  assetType,
  ...(assetType === "EMOJI" && canonicalExpression.codePointAt(0) !== undefined
    ? { unicode: canonicalExpression.codePointAt(0)!.toString(16) }
    : {}),
  description: `The institutional reference market for ${displayName.toLowerCase()} expression.`,
  active: true,
  currentIndexValue,
  marketPrice: Number(
    (currentIndexValue * (1 + (dailyChange / 100) * 0.06)).toFixed(2),
  ),
  previousClose: Number(
    (currentIndexValue / (1 + dailyChange / 100)).toFixed(2),
  ),
  dailyChange,
  weeklyChange: Number((dailyChange * 1.7).toFixed(1)),
  monthlyChange: Number((dailyChange * 3.2).toFixed(1)),
  confidence,
  createdAt,
});
// dailyChange values are deliberately mostly quiet (±0.2-2.5%), matching
// the "most days are quiet so a real shock reads as a shock" calibration
// target -- see the comment in packages/expression-engine/src/synthetic.ts.
// WILT is the one intentional standout, consistent with its documented
// "high-volatility regime" narrative event. Recalibrate against measured
// Bluesky prevalence once live history exists.
export const ASSETS: ExpressionAsset[] = [
  row("expr_crying_face", "CRY", "😭", "Crying Face", 8421, 1.4),
  row("expr_skull", "SKULL", "💀", "Skull", 7181, 0.9),
  row("expr_joy", "JOY", "😂", "Face with Tears of Joy", 5920, -1.1),
  row("expr_wilt", "WILT", "🥀", "Wilted Flower", 2811, 6.4, "EMOJI", 82),
  row("expr_pray", "PRAY", "🙏", "Folded Hands", 4119, 0.5),
  row("expr_fire", "FIRE", "🔥", "Fire", 6228, 2.4),
  row("expr_clown", "CLOWN", "🤡", "Clown Face", 3518, -0.7),
  row("expr_heart", "HEART", "❤️", "Red Heart", 9118, 0.2),
  row("expr_rocket", "ROCKET", "🚀", "Rocket", 2791, 3.5, "EMOJI", 88),
  row("expr_mind", "MIND", "🤯", "Exploding Head", 2212, 1.7),
  row(
    "expr_cooked",
    "COOKED",
    "we're cooked",
    "We’re Cooked",
    4381,
    3.1,
    "PHRASE",
    89,
  ),
  row("expr_lmao", "LMAO", "lmao", "LMAO", 6570, 0.7, "ACRONYM"),
  row("expr_bruh", "BRUH", "bruh", "Bruh", 4870, -0.5, "SLANG"),
  row("expr_mid", "MID", "mid", "Mid", 3160, -1.1, "SLANG"),
  row("expr_based", "BASED", "based", "Based", 2940, 1.5, "SLANG"),
  row("expr_w", "WIN", "W", "W", 5340, 1.6, "SLANG"),
  row("expr_l", "LOSS", "L", "L", 3880, 2.0, "SLANG"),
  row(
    "expr_back",
    "BACK",
    "we're so back",
    "We’re So Back",
    3620,
    3.9,
    "PHRASE",
  ),
  row("expr_over", "OVER", "it's over", "It’s Over", 4010, 2.4, "PHRASE"),
];
