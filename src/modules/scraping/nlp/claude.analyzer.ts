import { ActivityNLPResult, activityNLPResultSchema } from '../types';
import { createLogger } from '../../../lib/logger';

const log = createLogger('scraping:claude');

const SYSTEM_PROMPT = `Eres un analizador experto de actividades infantiles para la plataforma Infantia.
Tu tarea es extraer información estructurada de texto crudo de páginas web.

REGLAS:
- Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional.
- Si no encuentras un campo, omítelo o usa null.
- confidenceScore: 0.0 (nada útil) a 1.0 (toda la info clara).
- categories: usa nombres genéricos en español (Deportes, Música, Arte, Danza, Idiomas, Tecnología, Lúdico, Campamentos, etc.)
- price: número sin símbolo de moneda. Si dice "gratis", usa 0.
- pricePeriod: PER_SESSION, MONTHLY, TOTAL, o FREE.
- currency: código ISO (COP, USD, etc.) — por defecto COP.
- Fechas en formato YYYY-MM-DD.

ESTRUCTURA JSON ESPERADA:
{
  "title": "string",
  "description": "string (máx 300 caracteres)",
  "categories": ["string"],
  "minAge": number | null,
  "maxAge": number | null,
  "price": number | null,
  "pricePeriod": "PER_SESSION" | "MONTHLY" | "TOTAL" | "FREE" | null,
  "currency": "string",
  "location": { "address": "string", "city": "string" } | null,
  "schedules": [{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "notes": "string" }] | null,
  "confidenceScore": number
}`;

export class ClaudeAnalyzer {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
  }

  async analyze(sourceText: string, url: string): Promise<ActivityNLPResult> {
    if (!this.apiKey) {
      log.warn('⚠️ ANTHROPIC_API_KEY no encontrada. Usando resultado MOCK.');
      return this.mockAnalysis(url);
    }

    const truncatedText = sourceText.substring(0, 15000);
    const userMessage = `URL de origen: ${url}\n\nTEXTO CRUDO EXTRAÍDO:\n${truncatedText}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(`Claude API error: ${data.error.message}`);
      }

      const jsonStr = data.content[0].text;
      const cleaned = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error(`Claude retornó JSON inválido: ${cleaned.substring(0, 200)}`);
      }

      const validated = activityNLPResultSchema.safeParse(parsed);
      if (!validated.success) {
        log.error('Zod validation errors', { issues: validated.error.issues });
        throw new Error(`Respuesta de Claude no cumple el schema: ${validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
      }

      return validated.data;
    } catch (error: any) {
      log.error('Error en ClaudeAnalyzer:', error.message);
      throw error;
    }
  }

  private mockAnalysis(url: string): ActivityNLPResult {
    return {
      title: 'Actividad Infantil (Mock)',
      description: `Extracción simulada de ${url}`,
      categories: ['General'],
      minAge: 4,
      maxAge: 12,
      price: 50000,
      pricePeriod: 'MONTHLY',
      currency: 'COP',
      audience: 'KIDS' as const,
      location: { address: 'Calle Falsa 123', city: 'Bogotá' },
      schedules: null,
      confidenceScore: 0.85,
    };
  }
}
