// =============================================================================
// resolveCityId — Helper SSOT para resolver la ciudad activa
// Jerarquía estricta: URL > localStorage > default
// El backend nunca decide la ciudad. Solo el frontend a través de esta función.
// =============================================================================

export function resolveCityId({
  urlCityId,
  storedCityId,
  defaultCityId,
}: {
  urlCityId?: string | null
  storedCityId?: string | null
  defaultCityId: string
}): string {
  return urlCityId ?? storedCityId ?? defaultCityId
}
