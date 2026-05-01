import { getErrorMessage } from '../src/lib/error';
import { ScrapingStorage } from '../src/modules/scraping/storage';
import { ActivityNLPResult } from '../src/modules/scraping/types';

async function main() {
  const storage = new ScrapingStorage();
  
  const mockActivity: ActivityNLPResult = {
    title: "Taller de Prueba de Auditoria",
    description: "Una actividad de prueba para validar el nuevo contrato de Phase 3.",
    categories: ["Talleres", "Arte"],
    confidenceScore: 0.9,
    isActivity: true,
    currency: null,
    audience: 'ALL',
    schedules: [{ startDate: "2026-10-10", endDate: undefined, notes: "10:00 - Sesión inicial" }],
    location: { address: "Calle Falsa 123", city: "Bogotá" },
    price: 0,
    parserSource: 'gemini'
  };

  const url = "https://example.com/test-activity-" + Date.now();

  console.log('🚀 Iniciando Smoke Test de Phase 3...\n');

  try {
    // Escenario A: Actividad Nueva
    console.log('Escenario A: Guardando actividad nueva...');
    const resA = await storage.saveActivity(mockActivity, url);
    console.log('Resultado A:', resA);
    if (resA.action !== 'CREATED_ACTIVE' || !resA.id) throw new Error('Fallo Escenario A');

    // Escenario B: Update (Misma URL)
    console.log('\nEscenario B: Actualizando misma actividad (Update)...');
    const resB = await storage.saveActivity({ ...mockActivity, title: "Taller Actualizado" }, url);
    console.log('Resultado B:', resB);
    if (resB.action !== 'UPDATED_ACTIVE' || resB.id !== resA.id) throw new Error('Fallo Escenario B');

    // Escenario C: Deduplicación (Mismo Título y Fecha, Diferente URL)
    console.log('\nEscenario C: Detectando duplicado semántico (Dedupe)...');
    const urlC = "https://example.com/another-url-" + Date.now();
    const resC = await storage.saveActivity(mockActivity, urlC);
    console.log('Resultado C:', resC);
    if (resC.action !== 'DEDUPE_SKIPPED' || !resC.id) throw new Error('Fallo Escenario C');

    console.log('\n✅ SMOKE TEST EXITOSO. El refactor es estable.');
  } catch (err: unknown) {
    console.error('\n❌ FALLO EN SMOKE TEST:', getErrorMessage(err));
    process.exit(1);
  } finally {
    await storage.disconnect();
  }
}

main();
