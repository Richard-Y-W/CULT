export interface NativeRollingAnalytics {
  volatility: number;
  currentDrawdown: number;
  maximumDrawdown: number;
  zScore: number;
}

export interface CultNativeBinding {
  computeRollingAnalytics(series: number[]): NativeRollingAnalytics;
}

/**
 * Explicit native boundary. The C++ module is optional until a supported Node
 * toolchain builds it; callers retain the TypeScript golden path meanwhile.
 */
export async function loadNativeBinding(
  modulePath = "../../../build/cpp/cult_native.node",
): Promise<CultNativeBinding | null> {
  try {
    return (await import(modulePath)) as CultNativeBinding;
  } catch {
    return null;
  }
}
