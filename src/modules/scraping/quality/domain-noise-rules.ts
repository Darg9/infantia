export const DOMAIN_NOISE_RULES: Record<string, string[]> = {
  'fce.com.co': [
    '/producto/', 
    '/pqrs/', 
    '/tratamiento-de-datos', 
    '/terminos-y-condiciones',
    '/checkout',
    '/cart',
    '/categoria-producto/'
  ],
  'bogota.gov.co': [
    '/tramites/', 
    '/secretarias/',
    '/transparencia'
  ],
};

export const GLOBAL_NOISE_REGEX = /pqrs|tratamiento de datos|términos y condiciones|política de privacidad|habeas data|aviso de privacidad|iniciar sesión/i;

export function isDomainSpecificNoise(url: string, title: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace('www.', '');
    const path = parsedUrl.pathname.toLowerCase();

    // 1. Global Title check (Hard reject si el título contiene política de privacidad etc)
    if (GLOBAL_NOISE_REGEX.test(title)) return true;

    // 2. Domain Specific path check
    // Busca si existe alguna regla para el dominio exacto o sus subdominios
    const matchedDomain = Object.keys(DOMAIN_NOISE_RULES).find(
      domain => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (matchedDomain) {
      const rules = DOMAIN_NOISE_RULES[matchedDomain];
      return rules.some(r => path.includes(r.toLowerCase()));
    }

    return false;
  } catch {
    // Si la URL es inválida, no la bloqueamos aquí por path, pero el pipeline fallará
    return false;
  }
}
