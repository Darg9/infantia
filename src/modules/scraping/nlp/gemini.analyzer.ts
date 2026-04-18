import { GoogleGenerativeAI } from '@google/generative-ai';
import { ActivityNLPResult, activityNLPResultSchema, DiscoveredLink, discoveredActivityUrlsSchema, InstagramPost } from '../types';
import { createLogger } from '../../../lib/logger';
import { preFilterUrls, getProductivityTier } from '../../../lib/url-classifier';
import { isRetryableError } from '../parser/parser.types';
import { quota, getAvailableKey } from '../../../lib/quota-tracker';

const log = createLogger('scraping:gemini');

/**
 * Limpia patrones problemáticos de respuestas de Gemini antes de pasar a Zod.
 * - title: null o string vacío → 'Sin título'
 * - categories: null, no-array, o array vacío → ['General']
 * - currency: null → 'COP' (Zod ya tiene default pero por si acaso)
 */
function sanitizeGeminiResponse(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };

  // title
  if (!out.title || typeof out.title !== 'string' || !(out.title as string).trim()) {
    log.warn(`sanitize: title inválido (${JSON.stringify(out.title)}) → 'Sin título'`);
    out.title = 'Sin título';
  }

  // categories
  if (!Array.isArray(out.categories) || (out.categories as unknown[]).length === 0) {
    log.warn(`sanitize: categories inválido (${JSON.stringify(out.categories)}) → ['General']`);
    out.categories = ['General'];
  }

  // currency
  if (!out.currency || typeof out.currency !== 'string') {
    out.currency = 'COP';
  }

  return out;
}

const SYSTEM_PROMPT = `Eres un analizador experto de actividades infantiles para la plataforma HabitaPlan.
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

const INSTAGRAM_SYSTEM_PROMPT = `Eres un analizador experto de actividades infantiles para la plataforma HabitaPlan.
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

async function callWithRetry<T>(fn: () => Promise<T>, label: string, apiKey?: string): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status ?? error?.httpStatusCode ?? 0;
      const is429 = status === 429 || error.message?.includes('429');
      const isRetryable = status === 503 || is429 || error.message?.includes('503');

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        log.warn(`[${label}] Error ${status || 'retryable'} (intento ${attempt}/${MAX_RETRIES}). Reintentando en ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      // Último intento fallido con 429 → marcar cuota agotada
      if (is429 && apiKey) {
        await quota.markExhausted(apiKey).catch(() => {});
      }
      throw error;
    }
  }
  throw new Error(`[${label}] Agotados ${MAX_RETRIES} intentos`);
}

export class GeminiAnalyzer {
  private static lastRequestTime: number = 0;
  private static readonly MIN_REQUEST_INTERVAL_MS = 12000; // 5 RPM = 1 request per 12 seconds
  private static rateLimitEnabled = process.env.NODE_ENV !== 'test';

  // Selecciona la primera key disponible del pool y devuelve el modelo listo.
  // Retorna null si no hay keys configuradas (usar mockAnalysis).
  // Lanza [QUOTA_EXHAUSTED] si hay keys pero todas están agotadas.
  private async getModel(config: {
    systemInstruction?: string;
    maxOutputTokens: number;
  }): Promise<{ model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>; apiKey: string } | null> {
    const raw = process.env.GEMINI_KEYS ?? process.env.GOOGLE_AI_STUDIO_KEY ?? '';
    const configured = raw.split(',').filter((k) => k.trim().length > 0);
    if (configured.length === 0) return null; // sin keys → mockAnalysis

    const apiKey = await getAvailableKey();
    if (!apiKey) {
      throw new Error('[QUOTA_EXHAUSTED] Todas las keys de Gemini están agotadas.');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      ...(config.systemInstruction ? { systemInstruction: config.systemInstruction } : {}),
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: config.maxOutputTokens,
      },
    });
    return { model, apiKey };
  }

  private async enforceRateLimit(): Promise<void> {
    if (!GeminiAnalyzer.rateLimitEnabled) return;

    const now = Date.now();
    const timeSinceLastRequest = now - GeminiAnalyzer.lastRequestTime;
    if (timeSinceLastRequest < GeminiAnalyzer.MIN_REQUEST_INTERVAL_MS) {
      const delayMs = GeminiAnalyzer.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
      log.info(`Esperando ${(delayMs / 1000).toFixed(1)}s para respetar 5 RPM...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    GeminiAnalyzer.lastRequestTime = Date.now();
  }

  async analyze(sourceText: string, url: string): Promise<ActivityNLPResult> {
    const modelResult = await this.getModel({ systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 8192 });
    if (!modelResult) {
      log.warn('⚠️ GOOGLE_AI_STUDIO_KEY no encontrada. Usando resultado MOCK.');
      return this.mockAnalysis(url);
    }

    const truncatedText = sourceText.substring(0, 6000);
    const userMessage = `URL de origen: ${url}\n\nTEXTO CRUDO EXTRAÍDO:\n${truncatedText}`;

    try {
      const { model, apiKey } = modelResult;

      await this.enforceRateLimit();
      const result = await callWithRetry(
        () => model.generateContent(userMessage),
        'GEMINI',
        apiKey,
      );
      const rawText = result.response.text();

      // Limpiar posible markdown wrapping o whitespace
      const jsonStr = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      log.info(`Respuesta raw (primeros 500 chars): ${rawText.substring(0, 500)}`);

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr: any) {
        throw new Error(`Gemini retornó JSON inválido (${parseErr.message}): ${jsonStr.substring(0, 300)}`);
      }

      // Gemini a veces devuelve array en lugar de objeto — tomar el primer elemento
      if (Array.isArray(parsed)) {
        log.warn('Respuesta es array, tomando primer elemento.');
        parsed = parsed[0];
      }

      // Si Gemini indica baja confianza (nada útil encontrado), devolver resultado vacío válido
      const rawParsed = parsed as Record<string, unknown>;
      if (rawParsed.confidenceScore !== undefined && Number(rawParsed.confidenceScore) < 0.1) {
        log.warn('Confianza < 0.1 — el contenido no parece ser una actividad infantil.');
        return {
          title: 'No identificado',
          description: `No se encontró información de actividad infantil en ${url}`,
          categories: ['Sin categoría'],
          audience: 'ALL' as const,
          confidenceScore: 0,
          currency: 'COP',
        };
      }

      const sanitized = sanitizeGeminiResponse(parsed as Record<string, unknown>);
      const validated = activityNLPResultSchema.safeParse(sanitized);
      if (!validated.success) {
        log.error('Zod validation errors', { issues: validated.error.issues, raw: JSON.stringify(sanitized).substring(0, 300) });
        throw new Error(
          `Respuesta de Gemini no cumple el schema: ${validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        );
      }

      return validated.data;
    } catch (error: any) {
      log.error('Error en GeminiAnalyzer', { error });
      throw error;
    }
  }

  async discoverActivityLinks(links: DiscoveredLink[], sourceUrl: string): Promise<string[]> {
    // Extensiones de archivo que nunca son páginas de actividades
    const IMAGE_OR_BINARY_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?|pdf|mp4|mp3|zip|doc[x]?|xls[x]?|ppt[x]?)$/i;

    // Pre-filtro Stage 1: URLs que son claramente navegación/filtro/archivos
    const stage1Filtered = links.filter((l) => {
      try {
        const u = new URL(l.url);
        if (u.search.length > 0) return false;          // query params → navegación/filtro
        if (IMAGE_OR_BINARY_EXT.test(u.pathname)) return false; // imágenes y archivos binarios
        return true;
      } catch {
        return true;
      }
    });
    const stage1Excluded = links.length - stage1Filtered.length;
    if (stage1Excluded > 0) {
      log.info(`Pre-filtro Stage 1: ${stage1Excluded} URLs excluidas (query params o archivos binarios).`);
    }

    // Pre-filtro Stage 2: análisis de URL productividad (nuevo — S34)
    const urlClassifierResult = preFilterUrls(stage1Filtered.map((l) => l.url), 45);
    const stage2Excluded = urlClassifierResult.stats.filtered;

    if (stage2Excluded > 0) {
      log.info(`Pre-filtro Stage 2 (URL classifier): ${stage2Excluded} URLs excluidas (patrón no productivo).`);
      // Log algunos ejemplos de URLs excluidas
      const examples = urlClassifierResult.stats.scores
        .filter((s) => !urlClassifierResult.kept.includes(s.url))
        .slice(0, 3)
        .map((s) => `${s.url} (score ${s.score})`)
        .join('; ');
      if (examples) {
        log.debug(`Ejemplos excluidos: ${examples}`);
      }
    }

    // Filtrar links basado en URLs que pasaron ambos filtros
    const filtered = links.filter((l) => urlClassifierResult.kept.includes(l.url));
    const totalExcluded = links.length - filtered.length;
    if (totalExcluded > 0) {
      log.info(`Pre-filtros combinados: ${totalExcluded}/${links.length} URLs excluidas (${Math.round((totalExcluded / links.length) * 100)}% reducción). Enviando ${filtered.length} a Gemini.`);
    }

    // 100 URLs por lote (benchmark S34: chunk=100 reduce riesgo por quota-429)
    // Gemini free tier: 20 req/día — 100 URLs/lote balancea # llamadas vs riesgo de fallo
    // Banrep Bogotá (1.083 URLs) → 11 lotes (vs 6 con 200, vs 22 con 50)
    const CHUNK_SIZE = 100;
    const chunks: DiscoveredLink[][] = [];
    for (let i = 0; i < filtered.length; i += CHUNK_SIZE) {
      chunks.push(filtered.slice(i, i + CHUNK_SIZE));
    }

    log.info(`Procesando ${filtered.length} links en ${chunks.length} lotes de ${CHUNK_SIZE}`);

    const modelResult = await this.getModel({ maxOutputTokens: 8192 });
    if (!modelResult) {
      log.warn('⚠️ GOOGLE_AI_STUDIO_KEY no encontrada. Retornando todos los links.');
      return links.map((l) => l.url);
    }
    const { model, apiKey } = modelResult;

    const allActivityUrls: string[] = [];
    // Trackea el último error retryable (429/503) para propagarlo si todos los lotes fallan
    let lastRetryableError: unknown = null;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const linksText = chunk
        .map((l, i) => `${i + 1}. URL: ${l.url} | Texto: ${l.anchorText}`)
        .join('\n');

      const prompt = `Eres un filtro inteligente para la plataforma HabitaPlan.
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
        await this.enforceRateLimit();
        const result = await callWithRetry(
          () => model.generateContent(prompt),
          `GEMINI-DISCOVER-lote${chunkIndex + 1}`,
          apiKey,
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
          log.error(`Lote ${chunkIndex + 1}: JSON inválido (${parseErr.message})`);
          continue;
        }

        const validated = discoveredActivityUrlsSchema.safeParse(parsed);
        if (!validated.success) {
          log.error(`Lote ${chunkIndex + 1}: Validación falló`);
          continue;
        }

        // Mapear índices (1-based) de vuelta a URLs
        const found = validated.data.indices
          .filter((idx) => idx >= 1 && idx <= chunk.length)
          .map((idx) => chunk[idx - 1].url);
        log.info(`Lote ${chunkIndex + 1}/${chunks.length}: ${found.length} actividades encontradas`);
        allActivityUrls.push(...found);
      } catch (error: unknown) {
        if (isRetryableError(error)) {
          // Guardar para re-lanzar al final si no hay resultados (permite fallback en parser.ts)
          lastRetryableError = error;
          log.warn(`Lote ${chunkIndex + 1}: Gemini no disponible (retryable). Continuando con otros lotes...`);
        } else {
          log.error(`Lote ${chunkIndex + 1} Error: ${error instanceof Error ? error.message : String(error)}`, { error });
        }
      }
    }

    // Si hubo errores retryables y no se obtuvieron resultados de ningún lote,
    // re-lanzar para que discoverWithFallback active el fallback conservador.
    // Si hay resultados parciales (algún lote exitoso), usarlos en vez del fallback.
    if (allActivityUrls.length === 0 && lastRetryableError !== null) {
      throw lastRetryableError;
    }

    log.info(`Total actividades identificadas: ${allActivityUrls.length}`);
    return allActivityUrls;
  }

  /**
   * Analyze an Instagram post caption + profile bio to extract activity data.
   * Uses a prompt adapted for short captions, hashtags, and emojis.
   */
  async analyzeInstagramPost(post: InstagramPost, profileBio: string): Promise<ActivityNLPResult> {
    const modelResult = await this.getModel({ systemInstruction: INSTAGRAM_SYSTEM_PROMPT, maxOutputTokens: 4096 });
    if (!modelResult) {
      log.warn('⚠️ GOOGLE_AI_STUDIO_KEY no encontrada. Usando resultado MOCK.');
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
      const { model, apiKey } = modelResult;

      await this.enforceRateLimit();
      const result = await callWithRetry(
        () => model.generateContent(userMessage),
        'GEMINI-IG',
        apiKey,
      );
      const rawText = result.response.text();

      const jsonStr = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      log.info(`Respuesta raw (primeros 300 chars): ${rawText.substring(0, 300)}`);

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr: any) {
        throw new Error(`Gemini retornó JSON inválido para Instagram (${parseErr.message}): ${jsonStr.substring(0, 300)}`);
      }

      // Gemini a veces devuelve array en lugar de objeto — tomar el primer elemento
      if (Array.isArray(parsed)) {
        log.warn('Respuesta es array, tomando primer elemento.');
        parsed = parsed[0];
      }

      const rawParsed = parsed as Record<string, unknown>;
      if (rawParsed.confidenceScore !== undefined && Number(rawParsed.confidenceScore) < 0.1) {
        log.warn('Confianza < 0.1 — el post no parece ser una actividad infantil.');
        return {
          title: 'No identificado',
          description: `No se encontró información de actividad infantil en ${post.url}`,
          categories: ['Sin categoría'],
          audience: 'ALL' as const,
          confidenceScore: 0,
          currency: 'COP',
        };
      }

      const sanitized = sanitizeGeminiResponse(parsed as Record<string, unknown>);
      const validated = activityNLPResultSchema.safeParse(sanitized);
      if (!validated.success) {
        log.error('Zod validation errors (IG)', { issues: validated.error.issues, raw: JSON.stringify(sanitized).substring(0, 300) });
        throw new Error(
          `Respuesta de Gemini-IG no cumple el schema: ${validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        );
      }

      return validated.data;
    } catch (error: any) {
      log.error('Error en GeminiAnalyzer (Instagram)', { error });
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
