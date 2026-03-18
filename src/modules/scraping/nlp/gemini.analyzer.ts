import { GoogleGenerativeAI } from '@google/generative-ai';
import { ActivityNLPResult, activityNLPResultSchema, DiscoveredLink, discoveredActivityUrlsSchema, InstagramPost } from '../types';

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

AUDIENCIA (audience) — infiere basándote en el contenido:
- "KIDS": actividad exclusivamente para niños, sin presencia esperada de adultos como participantes (ej: taller de robótica para niños 6-12 años, club de lectura infantil).
- "FAMILY": actividad para familias completas o padres/adultos acompañando a niños (ej: obra de teatro familiar, paseo ecológico en familia, taller de manualidades para padres e hijos).
- "ADULTS": actividad exclusivamente para adultos (ej: yoga para mamás, curso de finanzas, taller de escritura creativa para adultos).
- "ALL": aplica a múltiples audiencias mezcladas, o no hay información suficiente para clasificar.

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
  "audience": "KIDS" | "FAMILY" | "ADULTS" | "ALL",
  "location": { "address": "string", "city": "string" } | null,
  "schedules": [{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "notes": "string" }] | null,
  "confidenceScore": number
}`;

const INSTAGRAM_SYSTEM_PROMPT = `Eres un analizador experto de actividades infantiles para la plataforma Infantia.
Tu tarea es extraer información estructurada de publicaciones de Instagram.

CONTEXTO: Recibirás el caption de un post de Instagram y la bio del perfil que lo publicó.
Los posts de Instagram son cortos, usan hashtags y emojis como indicadores clave.

REGLAS:
- Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown.
- Los HASHTAGS son pistas importantes de categoría (#arte → Arte, #talleres → Talleres, #danza → Danza, #musica → Música).
- Los emojis como 📅🗓️ indican fechas, 💰💲 precios, 👶🧒 edades, 📍 ubicación.
- La BIO del perfil puede contener dirección, ciudad y datos de contacto.
- Si el post NO es sobre una actividad infantil/familiar (es publicidad, meme, contenido personal), usa confidenceScore: 0.0
- Si el post menciona una actividad pero con poca info, usa confidenceScore entre 0.3 y 0.6.
- Si tiene título, descripción, fechas y/o precio claro, usa confidenceScore >= 0.7.
- categories: usa nombres genéricos en español (Deportes, Música, Arte, Danza, Idiomas, Tecnología, Lúdico, Campamentos, Ciencia, Teatro, Cocina, Literatura, etc.)
- price: número sin símbolo de moneda. Si dice "gratis" o "entrada libre", usa 0.
- pricePeriod: PER_SESSION, MONTHLY, TOTAL, o FREE.
- currency: código ISO (COP, USD, MXN, etc.) — por defecto COP.
- Fechas en formato YYYY-MM-DD.

AUDIENCIA (audience) — infiere basándote en hashtags, emojis y texto:
- "KIDS": actividad exclusivamente para niños (👶🧒 #niños #infantil #kids #children).
- "FAMILY": actividad para toda la familia o padres con hijos (👨‍👩‍👧 #familia #family #padresehijos).
- "ADULTS": exclusivamente para adultos (mamás, papás sin niños como participantes).
- "ALL": aplica a múltiples audiencias o no hay información suficiente.

ESTRUCTURA JSON ESPERADA:
{
  "title": "string (nombre de la actividad)",
  "description": "string (máx 300 caracteres, en español)",
  "categories": ["string"],
  "minAge": number | null,
  "maxAge": number | null,
  "price": number | null,
  "pricePeriod": "PER_SESSION" | "MONTHLY" | "TOTAL" | "FREE" | null,
  "currency": "string",
  "audience": "KIDS" | "FAMILY" | "ADULTS" | "ALL",
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
          audience: 'ALL' as const,
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

    const CHUNK_SIZE = 50;
    const chunks: DiscoveredLink[][] = [];
    for (let i = 0; i < links.length; i += CHUNK_SIZE) {
      chunks.push(links.slice(i, i + CHUNK_SIZE));
    }

    console.log(`[GEMINI-DISCOVER] Procesando ${links.length} links en ${chunks.length} lotes de ${CHUNK_SIZE}`);

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    });

    const allActivityUrls: string[] = [];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const linksText = chunk
        .map((l, i) => `${i + 1}. URL: ${l.url} | Texto: ${l.anchorText}`)
        .join('\n');

      const prompt = `Eres un filtro inteligente para la plataforma Infantia.
Te doy una lista numerada de links extraídos de: ${sourceUrl}

Tu tarea: selecciona SOLO los links que probablemente lleven a páginas de actividades, eventos, talleres, cursos o programas para niños, jóvenes o familias.

EXCLUYE: links de navegación general (inicio, contacto, nosotros, login, redes sociales), políticas de privacidad, páginas corporativas.

INCLUYE: links a eventos específicos, talleres, cursos, programas culturales, actividades recreativas, clubes de lectura, etc.

Responde con JSON: { "indices": [1, 3, 7, ...] }
Los números son los índices (posición en la lista, comenzando en 1) de los links seleccionados.
Si ningún link parece ser una actividad, devuelve { "indices": [] }

LINKS:
${linksText}`;

      try {
        const result = await callWithRetry(
          () => model.generateContent(prompt),
          `GEMINI-DISCOVER-lote${chunkIndex + 1}`,
        );
        const rawText = result.response.text();
        const jsonStr = rawText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```\s*$/, '')
          .trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (parseErr: any) {
          console.error(`[GEMINI-DISCOVER] Lote ${chunkIndex + 1}: JSON inválido (${parseErr.message})`);
          continue;
        }

        const validated = discoveredActivityUrlsSchema.safeParse(parsed);
        if (!validated.success) {
          console.error(`[GEMINI-DISCOVER] Lote ${chunkIndex + 1}: Validación falló`);
          continue;
        }

        // Mapear índices (1-based) de vuelta a URLs
        const found = validated.data.indices
          .filter((idx) => idx >= 1 && idx <= chunk.length)
          .map((idx) => chunk[idx - 1].url);
        console.log(`[GEMINI-DISCOVER] Lote ${chunkIndex + 1}/${chunks.length}: ${found.length} actividades encontradas`);
        allActivityUrls.push(...found);
      } catch (error: any) {
        console.error(`[GEMINI-DISCOVER] Lote ${chunkIndex + 1} Error:`, error.message);
      }
    }

    console.log(`[GEMINI-DISCOVER] Total actividades identificadas: ${allActivityUrls.length}`);
    return allActivityUrls;
  }

  /**
   * Analyze an Instagram post caption + profile bio to extract activity data.
   * Uses a prompt adapted for short captions, hashtags, and emojis.
   */
  async analyzeInstagramPost(post: InstagramPost, profileBio: string): Promise<ActivityNLPResult> {
    if (!this.genAI) {
      console.warn('⚠️ GOOGLE_AI_STUDIO_KEY no encontrada. Usando resultado MOCK.');
      return this.mockAnalysis(post.url);
    }

    const userMessage = `POST DE INSTAGRAM:
URL: ${post.url}
Fecha: ${post.timestamp ?? 'No disponible'}
Likes: ${post.likesCount ?? 'No disponible'}

CAPTION DEL POST:
${post.caption}

BIO DEL PERFIL:
${profileBio}`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: INSTAGRAM_SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      });

      const result = await callWithRetry(
        () => model.generateContent(userMessage),
        'GEMINI-IG',
      );
      const rawText = result.response.text();

      const jsonStr = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      console.log(`[GEMINI-IG] Respuesta raw (primeros 300 chars): ${rawText.substring(0, 300)}`);

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr: any) {
        throw new Error(`Gemini retornó JSON inválido para Instagram (${parseErr.message}): ${jsonStr.substring(0, 300)}`);
      }

      const rawParsed = parsed as Record<string, unknown>;
      if (rawParsed.confidenceScore !== undefined && Number(rawParsed.confidenceScore) < 0.1) {
        console.warn('[GEMINI-IG] Confianza < 0.1 — el post no parece ser una actividad infantil.');
        return {
          title: 'No identificado',
          description: `No se encontró información de actividad infantil en ${post.url}`,
          categories: ['Sin categoría'],
          audience: 'ALL' as const,
          confidenceScore: 0,
          currency: 'COP',
        };
      }

      const validated = activityNLPResultSchema.safeParse(parsed);
      if (!validated.success) {
        console.error('Zod validation errors:', validated.error.issues);
        throw new Error(
          `Respuesta de Gemini-IG no cumple el schema: ${validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        );
      }

      return validated.data;
    } catch (error: any) {
      console.error('Error en GeminiAnalyzer (Instagram):', error.message);
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
      audience: 'KIDS',
      location: { address: 'Calle Falsa 123', city: 'Bogotá' },
      schedules: null,
      confidenceScore: 0.85,
    };
  }
}
