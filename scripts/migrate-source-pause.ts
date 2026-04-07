/**
 * Migration: Agregar tablas para source pause config y URL stats tracking
 * Ejecutar: npx tsx scripts/migrate-source-pause.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🔄 Creando tablas SourcePauseConfig y SourceUrlStats...\n');

  try {
    // Crear tabla SourcePauseConfig
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS source_pause_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL,
        city_id UUID,
        pause_threshold_score SMALLINT NOT NULL DEFAULT 20,
        pause_duration_days SMALLINT NOT NULL DEFAULT 7,
        auto_pause_enabled BOOLEAN NOT NULL DEFAULT true,
        paused_at TIMESTAMPTZ,
        paused_reason VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (source_id) REFERENCES scraping_source(id) ON DELETE CASCADE,
        FOREIGN KEY (city_id) REFERENCES city(id) ON DELETE SET NULL,
        UNIQUE (source_id, city_id)
      )
    `);
    console.log('✅ Tabla source_pause_config creada');

    // Crear tabla SourceUrlStats
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS source_url_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL,
        city_id UUID,
        avg_url_score DECIMAL(5,2),
        low_score_count SMALLINT DEFAULT 0,
        high_score_count SMALLINT DEFAULT 0,
        total_urls_processed INTEGER DEFAULT 0,
        last_scan_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (source_id) REFERENCES scraping_source(id) ON DELETE CASCADE,
        FOREIGN KEY (city_id) REFERENCES city(id) ON DELETE SET NULL,
        UNIQUE (source_id, city_id)
      )
    `);
    console.log('✅ Tabla source_url_stats creada');

    // Crear índices
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_source_pause_config_paused
      ON source_pause_config(paused_at)
      WHERE paused_at IS NOT NULL
    `);
    console.log('✅ Índice source_pause_config.paused_at creado');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_source_url_stats_avg_score
      ON source_url_stats(avg_url_score)
    `);
    console.log('✅ Índice source_url_stats.avg_url_score creado');

    console.log('\n✨ Migration completada exitosamente\n');
  } catch (error: any) {
    if (error.code === 'POSTGRES_ERROR' && error.message.includes('already exists')) {
      console.log('ℹ️  Tablas ya existen — saltando...\n');
    } else {
      console.error('❌ Error en migration:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

migrate().catch(console.error);
