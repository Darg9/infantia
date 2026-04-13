export function getAdaptiveRules(metrics?: {
  pctShort: number;
  pctNoise: number;
} | null) {
  return {
    forceStructured: metrics ? metrics.pctShort > 20 : false,
    minDescriptionLength: metrics && metrics.pctNoise > 15 ? 60 : 40,
  };
}

export function getSourceRules(score?: number | null) {
  if (!score && score !== 0) {
    return {
      forceStructured: false,
      minDescriptionLength: 40
    };
  }

  if (score < 0.4) {
    return {
      forceStructured: true,
      minDescriptionLength: 80
    };
  }

  if (score > 0.8) {
    return {
      forceStructured: false,
      minDescriptionLength: 30
    };
  }

  return {
    forceStructured: false,
    minDescriptionLength: 40
  };
}
