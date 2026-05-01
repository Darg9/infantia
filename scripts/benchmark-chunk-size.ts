#!/usr/bin/env npx tsx
import { getErrorMessage } from '../src/lib/error';
/**
 * Benchmark: CHUNK_SIZE 50 vs 100 vs 200 en Gemini discoverActivityLinks
 * Fuente de prueba: Banrep Ibagué (causa original del problema de JSON inválido)
 *
 * Ejecutar: npx tsx scripts/benchmark-chunk-size.ts [--chunk=100] [--dry-run]
 *
 * Consumo estimado de cuota Gemini (free tier 20 req/día):
 *   chunk=50:  ~3 lotes = 3 llamadas
 *   chunk=100: ~2 lotes = 2 llamadas
 *   chunk=200: ~1 lote  = 1 llamada
 *
 * Para benchmark completo (3 tamaños):
 *   npx tsx scripts/benchmark-chunk-size.ts  → usa ~6-8 llamadas
 */

import 'dotenv/config';
import * as https from 'https';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { preFilterUrls } from '../src/lib/url-classifier';

// ── Config ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const singleChunk = args.find((a) => a.startsWith('--chunk='))
  ? parseInt(args.find((a) => a.startsWith('--chunk='))!.split('=')[1]!)
  : null;

const CHUNK_SIZES = singleChunk ? [singleChunk] : [50, 100, 200];
const RATE_LIMIT_MS = 12_000; // 12s entre llamadas (5 RPM)
const SITEMAP_URL = 'https://www.banrepcultural.org/sitemap.xml';
const CITY_FILTER = '/ibague/';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface BenchmarkResult {
  chunkSize: number;
  totalUrls: number;
  urlsAfterClassifier: number;
  classifierReduction: number;
  chunksCount: number;
  apiCalls: number;
  successCalls: number;
  jsonErrors: number;
  activitiesFound: number;
  durationMs: number;
}

// ── HTTP helper ────────────────────────────────────────────────────────────
function fetchXml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'HabitaPlan/1.0' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

// ── Parsear sitemap XML paginado ───────────────────────────────────────────
async function parseSitemapUrls(baseUrl: string, filterPath: string): Promise<string[]> {
  const urls: string[] = [];

  // Primero revisar si tiene sub-sitemaps paginados
  const mainXml = await fetchXml(baseUrl);
  const subSitemaps = [...mainXml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => u.includes('sitemap.xml?page=') || u.includes('sitemap_'));

  if (subSitemaps.length > 0) {
    // Sitemap paginado: iterar cada página con delay
    for (const pageUrl of subSitemaps) {
      const pageXml = await fetchXml(pageUrl);
      const pageUrls = [...pageXml.matchAll(/<loc>(.*?)<\/loc>/g)]
        .map((m) => m[1].trim())
        .filter((u) => u.includes(filterPath));
      urls.push(...pageUrls);
      await new Promise((r) => setTimeout(r, 800)); // Rate limit: 0.8s entre páginas
    }
  } else {
    // Sitemap simple
    const simpleUrls = [...mainXml.matchAll(/<loc>(.*?)<\/loc>/g)]
      .map((m) => m[1].trim())
      .filter((u) => u.includes(filterPath));
    urls.push(...simpleUrls);
  }

  return urls;
}

// ── Gemini discover links ──────────────────────────────────────────────────
async function discoverLinksWithChunk(
  links: Array<{ url: string; anchorText: string }>,
  chunkSize: number,
  genAI: GoogleGenerativeAI,
): Promise<{
  activitiesFound: number;
  apiCalls: number;
  successCalls: number;
  jsonErrors: number;
  durationMs: number;
}> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  });

  const chunks: typeof links[] = [];
  for (let i = 0; i < links.length; i += chunkSize) {
    chunks.push(links.slice(i, i + chunkSize));
  }

  const allActivityUrls: string[] = [];
  let apiCalls = 0;
  let successCalls = 0;
  let jsonErrors = 0;
  const startTime = Date.now();
  let lastCallTime = 0;

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];

    // Rate limit enforcement
    const now = Date.now();
    const elapsed = now - lastCallTime;
    if (lastCallTime > 0 && elapsed < RATE_LIMIT_MS) {
      const waitMs = RATE_LIMIT_MS - elapsed;
      process.stdout.write(`  ⏳ Rate limit: esperando ${(waitMs / 1000).toFixed(1)}s...`);
      await new Promise((r) => setTimeout(r, waitMs));
      console.log(' OK');
    }

    const linksText = chunk
      .map((l, i) => `${i + 1}. URL: ${l.url} | Texto: ${l.anchorText}`)
      .join('\n');

    const prompt = `Selecciona SOLO los links a actividades, eventos, talleres o programas para niños/familias.
Excluye navegación general, políticas, páginas corporativas.
Responde con JSON: { "indices": [1, 3, 7, ...] }

LINKS:
${linksText}`;

    try {
      apiCalls++;
      lastCallTime = Date.now();
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const jsonStr = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      let parsed: { indices?: number[] };
      try {
        parsed = JSON.parse(jsonStr);
      } catch (_) {
        jsonErrors++;
        console.log(`  ❌ Lote ${idx + 1}: JSON inválido (${jsonStr.substring(0, 80)}...)`);
        continue;
      }

      const indices = parsed.indices ?? [];
      const found = indices
        .filter((i) => i >= 1 && i <= chunk.length)
        .map((i) => chunk[i - 1].url);

      successCalls++;
      allActivityUrls.push(...found);
      console.log(
        `  ✅ Lote ${idx + 1}/${chunks.length}: ${found.length} actividades (${chunk.length} URLs enviadas)`,
      );
    } catch (err: unknown) {
      apiCalls++;
      jsonErrors++;
      console.log(`  ❌ Lote ${idx + 1}: Error API — ${getErrorMessage(err)?.substring(0, 80)}`);
    }
  }

  return {
    activitiesFound: allActivityUrls.length,
    apiCalls,
    successCalls,
    jsonErrors,
    durationMs: Date.now() - startTime,
  };
}

// ── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('⚡ BENCHMARK: CHUNK_SIZE vs JSON Parsing Success Rate');
  console.log('='.repeat(70));
  console.log(`Fuente: Banrep Ibagué (${SITEMAP_URL})`);
  console.log(`Tamaños a probar: ${CHUNK_SIZES.join(', ')}`);
  console.log(`Dry-run: ${dryRun ? 'SÍ (sin Gemini)' : 'NO (usa cuota API)'}\n`);

  // 1. Fetch sitemap (paginado)
  console.log('📥 Descargando sitemap.xml de Banrep (puede tomar ~8s si paginado)...');
  const allUrls = await parseSitemapUrls(SITEMAP_URL, CITY_FILTER);
  console.log(`   → ${allUrls.length} URLs filtradas con "${CITY_FILTER}"`);

  if (allUrls.length === 0) {
    console.error('\n❌ No se encontraron URLs. Verifica conectividad o filtro de ciudad.');
    process.exit(1);
  }

  // 2. Aplicar URL classifier (Stage 2)
  console.log('\n🔍 Aplicando URL classifier (threshold=45)...');
  const classifierResult = preFilterUrls(allUrls, 45);
  const classifiedUrls = classifierResult.kept;

  console.log(`   → ${allUrls.length} originales → ${classifiedUrls.length} después del filtro`);
  console.log(
    `   → Reducción: ${classifierResult.stats.reductionPct}% (${classifierResult.stats.filtered} eliminadas)`,
  );

  // Convertir a formato DiscoveredLink
  const links = classifiedUrls.map((url) => ({
    url,
    anchorText: url.split('/').pop()?.replace(/-/g, ' ') ?? '',
  }));

  if (dryRun) {
    console.log('\n🔸 Dry-run: Simulando chunks sin llamar a Gemini...\n');
    const results: BenchmarkResult[] = CHUNK_SIZES.map((chunkSize) => {
      const chunksCount = Math.ceil(classifiedUrls.length / chunkSize);
      return {
        chunkSize,
        totalUrls: allUrls.length,
        urlsAfterClassifier: classifiedUrls.length,
        classifierReduction: classifierResult.stats.reductionPct,
        chunksCount,
        apiCalls: chunksCount,
        successCalls: Math.floor(chunksCount * 0.9), // simula 90% success
        jsonErrors: Math.ceil(chunksCount * 0.1),
        activitiesFound: 0,
        durationMs: chunksCount * RATE_LIMIT_MS,
      };
    });
    printReport(results, allUrls.length, classifiedUrls.length);
    return;
  }

  // 3. Verificar API key
  const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;
  if (!apiKey) {
    console.error('\n❌ GOOGLE_AI_STUDIO_KEY no encontrada en .env');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const results: BenchmarkResult[] = [];

  // 4. Ejecutar benchmark para cada chunk size
  for (const chunkSize of CHUNK_SIZES) {
    const chunksCount = Math.ceil(classifiedUrls.length / chunkSize);
    console.log(
      `\n${'─'.repeat(60)}\n📦 Probando CHUNK_SIZE = ${chunkSize} (${chunksCount} lotes)`,
    );
    console.log('─'.repeat(60));

    const benchStart = Date.now();
    const result = await discoverLinksWithChunk(links, chunkSize, genAI);

    results.push({
      chunkSize,
      totalUrls: allUrls.length,
      urlsAfterClassifier: classifiedUrls.length,
      classifierReduction: classifierResult.stats.reductionPct,
      chunksCount,
      ...result,
      durationMs: Date.now() - benchStart,
    });
  }

  // 5. Reporte final
  printReport(results, allUrls.length, classifiedUrls.length);
}

function printReport(
  results: BenchmarkResult[],
  totalUrls: number,
  urlsAfterClassifier: number,
) {
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 RESULTADOS DEL BENCHMARK');
  console.log('='.repeat(70));
  console.log(`\nFuente: Banrep Ibagué`);
  console.log(`URLs en sitemap: ${totalUrls}`);
  console.log(`URLs después del URL Classifier: ${urlsAfterClassifier}`);

  console.log('\n┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Chunk    │ Lotes    │ API Calls│ Errores  │ Activid. │ Tiempo   │');
  console.log('├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

  for (const r of results) {
    const successRate =
      r.apiCalls > 0 ? ((r.successCalls / r.apiCalls) * 100).toFixed(0) + '%' : 'N/A';
    console.log(
      `│ ${String(r.chunkSize).padEnd(8)} │ ${String(r.chunksCount).padEnd(8)} │ ${String(r.apiCalls).padEnd(8)} │ ${(r.jsonErrors > 0 ? '⚠️ ' + r.jsonErrors : r.jsonErrors).toString().padEnd(8)} │ ${String(r.activitiesFound).padEnd(8)} │ ${((r.durationMs / 1000).toFixed(1) + 's').padEnd(8)} │`,
    );
  }
  console.log('└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');

  // Análisis
  const bestResult = results
    .filter((r) => r.jsonErrors === 0)
    .sort((a, b) => b.activitiesFound - a.activitiesFound || a.apiCalls - b.apiCalls)[0];

  console.log('\n🔍 Análisis:');
  results.forEach((r) => {
    const successPct = r.apiCalls > 0 ? Math.round((r.successCalls / r.apiCalls) * 100) : 0;
    const label = r === bestResult ? ' ← GANADOR' : '';
    console.log(
      `   chunk=${r.chunkSize}: ${successPct}% éxito JSON, ${r.activitiesFound} actividades, ${r.jsonErrors} errores${label}`,
    );
  });

  if (bestResult) {
    console.log(`\n✅ Recomendación: CHUNK_SIZE = ${bestResult.chunkSize}`);
    if (bestResult.chunkSize !== 200) {
      const diff = results.find((r) => r.chunkSize === 200);
      if (diff) {
        const extraCalls = bestResult.apiCalls - diff.apiCalls;
        console.log(
          `   (${extraCalls} llamadas extra vs chunk=200, pero ${results.find((r) => r.chunkSize === 200)?.jsonErrors ?? 0} errores JSON menos)`,
        );
      }
    }
  } else {
    console.log('\n⚠️ Todos los tamaños mostraron errores JSON — revisar conexión o cuota.');
  }

  console.log('\n📌 Para cambiar en producción:');
  console.log('   Editar src/modules/scraping/nlp/gemini.analyzer.ts');
  console.log('   const CHUNK_SIZE = <valor>;');
  console.log('\n' + '='.repeat(70) + '\n');
}

main().catch((err) => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
