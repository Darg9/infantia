import { GoogleGenerativeAI } from '@google/generative-ai';
import { ActivityNLPResult, activityNLPResultSchema, DiscoveredLink, discoveredActivityUrlsSchema } from '../types';

const SYSTEM_PROMPT = `Eres un analizador experto de actividades infantiles para la plataforma Infantia.
Tu tarea es extraer información estructurada de texto crudo de páginas web.

REGLAS:
- Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown.
- Si el texto está en otro idioma, traduce título y descripción al español.
- Si no encuentras un campo, omítelo o usa null.
- confidenceScore: 0.0 (nada útil encontrado) a 1.0 (toda la información clara y completa).
- categories: usa nombres genéricos en español (Deportes, Música, Arte, Danza, Idiomas, Tecnología, Lúdico, Campamentos, Ciencia, Teatro, Cocina, etc.)
- price: número sin símbolo de moneda. Si dice "gratis", usa 0.
- pricePeriod: PER_SESSION, MONTHLY, TOTAL, o FREE.
- currency: código ISO (COP, USD, MXN, etc.) — por defecto COP.
- Fechas en formato YYYY-MM-DD.

ESTRUCTURA JSON ESPERADA:
{
  "title": "string",
  "description": "string (máx 300 caracteres, en español)",
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

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

async function callWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status ?? error?.httpStatusCode ?? 0;
      const isRetryable = status === 503 || status === 429 || error.message?.includes('503') || error.message?.includes('429');

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        console.warn(`[${label}] Error ${status || 'retryable'} (intento ${attempt}/${MAX_RETRIES}). Reintentando en ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`[${label}] Agotados ${MAX_RETRIES} intentos`);
}

export class GeminiAnalyzer {
  private genAI: GoogleGenerativeAI | null;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_STUDIO_KEY || '';
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  async analyze(sourceText: string, url: string): Promise<ActivityNLPResult> {
    if (!this.genAI) {
      console.warn('⚠️ GOOGLE_AI_STUDIO_KEY no encontrada. Usando resultado MOCK.');
      return this.mockAnalysis(url);
    }

    const truncatedText = sourceText.substring(0, 15000);
    const userMessage = `URL de origen: ${url}\n\nTEXTO CRUDO EXTRAÍDO:\n${truncatedText}`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      });

      const result = await callWithRetry(
        () => model.generateContent(userMessage),
        'GEMINI',
      );
      const rawText = result.response.text();

      // Limpiar posible markdown wrapping o whitespace
      const jsonStr = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      console.log(`[GEMINI] Respuesta raw (primeros 500 chars): ${rawText.substring(0, 500)}`);

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr: any) {
        throw new Error(`Gemini retornó JSON inválido (${parseErr.message}): ${jsonStr.substring(0, 300)}`);
      }

      // Si Gemini indica baja confianza (nada útil encontrado), devolver resultado vacío válido
      const rawParsed = parsed as Record<string, unknown>;
      if (rawParsed.confidenceScore !== undefined && Number(rawParsed.confidenceScore) < 0.1) {
        console.warn('[GEMINI] Confianza < 0.1 — el contenido no parece ser una actividad infantil.');
        return {
          title: 'No identificado',
          description: `No se encontró información de actividad infantil en ${url}`,
          categories: ['Sin categoría'],
          confidenceScore: 0,
          currency: 'COP',
        };
      }

      const validated = activityNLPResultSchema.safeParse(parsed);
      if (!validated.success) {
        console.error('Zod validation errors:', validated.error.issues);
        throw new Error(
          `Respuesta de Gemini no cumple el schema: ${validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        );
      }

      return validated.data;
    } catch (error: any) {
      console.error('Error en GeminiAnalyzer:', error.message);
      throw error;
    }
  }

  async discoverActivityLinks(links: DiscoveredLink[], sourceUrl: string): Promise<string[]> {
    if (!this.genAI) {
      console.warn('⚠️ GOOGLE_AI_STUDIO_KEY no encontrada. Retornando todos los links.');
      return links.map((l) => l.url);
    }

    const linksText = links
      .map((l, i) => `${i + 1}. URL: ${l.url} | Texto: ${l.anchorText}`)
      .join('\n');

    const prompt = `Eres un filtro inteligente para la plataforma Infantia.
Te doy una lista de links extraídos de: ${sourceUrl}

Tu tarea: selecciona SOLO los links que probablemente lleven a páginas de actividades, eventos, talleres, cursos o programas para niños, jóvenes o familias.

EXCLUYE: links de navegación general (inicio, contacto, nosotros, login, redes sociales), políticas de privacidad, páginas corporativas.

INCLUYE: links a eventos específicos, talleres, cursos, programas culturales, actividades recreativas, clubes de lectura, etc.

Responde con JSON: { "activityUrls": ["url1", "url2", ...] }
Si ningún link parece ser una actividad, devuelve { "activityUrls": [] }

LINKS:
${linksText}`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      });

      const result = await callWithRetry(
        () => model.generateContent(prompt),
        'GEMINI-DISCOVER',
      );
      const rawText = result.response.text();
      const jsonStr = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      console.log(`[GEMINI-DISCOVER] Respuesta raw (primeros 500 chars): ${rawText.substring(0, 500)}`);

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr: any) {
        console.error(`[GEMINI-DISCOVER] JSON inválido (${parseErr.message}): ${jsonStr.substring(0, 300)}`);
        return [];
      }

      const validated = discoveredActivityUrlsSchema.safeParse(parsed);
      if (!validated.success) {
        console.error('[GEMINI-DISCOVER] Validación falló:', validated.error.issues);
        return [];
      }

      return validated.data.activityUrls;
    } catch (error: any) {
      console.error('[GEMINI-DISCOVER] Error:', error.message);
      return [];
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
      location: { address: 'Calle Falsa 123', city: 'Bogotá' },
      schedules: null,
      confidenceScore: 0.85,
    };
  }
}
