export function isValidActivity(activity: {
  title?: string | null;
  description?: string | null;
}): { valid: boolean; reason?: 'short_title' | 'short_description' | 'invalid_chars' | 'spam_promo' } {
  if (!activity.title || activity.title.length < 5) return { valid: false, reason: 'short_title' };

  if (!activity.description || activity.description.length < 40) return { valid: false, reason: 'short_description' };
  
  // Evitar strings que no contienen vocales/consonantes tipo "🔥🔥🔥" o "---" o "12345"
  if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(activity.description)) return { valid: false, reason: 'invalid_chars' };

  // Evitar textos basura puramente promocionales sin sustancia
  if (/^(haz clic|más info|link en bio)$/i.test(activity.description)) {
    return { valid: false, reason: 'spam_promo' };
  }

  return { valid: true };
}
