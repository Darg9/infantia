import { execSync } from "child_process";

try {
  execSync("npx prisma validate", { stdio: "inherit" });
  console.log("✅ Prisma schema válido");
} catch {
  console.error("❌ Error en schema Prisma");
  process.exit(1);
}
