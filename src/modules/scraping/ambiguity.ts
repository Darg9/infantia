export function ambiguityScore(text: string): number {
  let score = 0;

  if (!text) return 3;

  if (text.length < 60) score += 1;

  if (/[#@]|https?:\/\//.test(text)) score += 1;

  if (/^(te invitamos|no te pierdas|ven|descubre)/i.test(text)) score += 1;

  return score;
}
