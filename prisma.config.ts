import 'dotenv/config';
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // DIRECT_URL para comandos CLI (migrate, db push) — evita P1017 con el pooler de Supabase.
    // El runtime (Next.js / workers) usa DATABASE_URL via src/lib/db.ts con adapter-pg.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
