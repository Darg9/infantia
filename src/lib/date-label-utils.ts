// =============================================================================
// date-label-utils.ts — Labels temporales editoriales para ActivityCard
// =============================================================================
//
// Genera etiquetas humanas y contextuales para la fecha de inicio de una actividad.
// Diseñado para ser:
//   - SSR-safe (sin browser APIs)
//   - Timezone-aware (Colombia = UTC-5, sin DST)
//   - Reusable en Home, /actividades, carruseles, feeds
//
// Salida posible:
//   "Hoy"         "Hoy · 4 PM"    "Mañana"
//   "Vie 16"      "Este fin de semana"
//   "18–20 May"   "18 May"        null (sin fecha)
//
// NUNCA retorna fechas ISO, timestamps técnicos ni rangos de año.
// =============================================================================

/** Colombia = UTC-5, sin ajuste por horario de verano */
const COL_OFFSET_MS = 5 * 60 * 60 * 1000;

const DAY_NAMES  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const;

const SCHEDULE_DAY_MAP: Record<string, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};

/** Convierte un Date UTC a un Date donde los campos UTC representan hora Colombia local */
function toColDate(date: Date): Date {
  return new Date(date.getTime() - COL_OFFSET_MS);
}

/** true si dos fechas (ya en COL) caen el mismo día calendario */
function isSameColDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth()    === b.getUTCMonth()    &&
    a.getUTCDate()     === b.getUTCDate()
  );
}

/** "3 PM", "10:30 AM" — solo cuando la hora no es medianoche */
function formatColTime(hours: number, minutes: number): string {
  const h = hours % 12 || 12;
  const m = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : '';
  const period = hours < 12 ? 'AM' : 'PM';
  return `${h}${m} ${period}`;
}

/** Traduce days[] de schedule JSON a label legible */
function formatScheduleDays(days: string[]): string | null {
  if (!days.length) return null;
  const hasWeekend = days.includes('sat') && days.includes('sun');
  const hasFullWeek =
    ['mon', 'tue', 'wed', 'thu', 'fri'].every((d) => days.includes(d));

  if (hasWeekend && days.length === 2) return 'Fines de semana';
  if (hasFullWeek && days.length === 5) return 'Lun–Vie';
  if (hasFullWeek && hasWeekend)        return 'Todos los días';

  return days.map((d) => SCHEDULE_DAY_MAP[d] ?? d).join(' · ');
}

// ─── Tipo de entrada ──────────────────────────────────────────────────────────

export interface ActivityDateInfo {
  startDate?:  string | Date | null;
  endDate?:    string | Date | null;
  /** schedule JSON: { days: ["sat","sun"], start: "10:00", end: "12:00" } */
  schedule?:   unknown;
  type?:       string;
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Retorna un label temporal editorial para mostrar en la tarjeta de actividad.
 *
 * @param activity — objeto con campos temporales de la actividad
 * @param now      — referencia temporal (inyectada en tests; por defecto new Date())
 * @returns string | null — null = sin fecha conocida, no mostrar nada
 *
 * @example
 * getEditorialDateLabel({ startDate: '2026-05-18T20:00:00Z' }) // "18 May"
 * getEditorialDateLabel({ startDate: '2026-05-12T20:00:00Z' }) // "Hoy · 3 PM"  (si hoy es 12 mayo COL)
 */
export function getEditorialDateLabel(
  activity: ActivityDateInfo,
  now?: Date,
): string | null {
  const ref     = now ?? new Date();
  const nowCol  = toColDate(ref);

  // ── Sin startDate: intentar derivar de schedule (actividades recurrentes) ──
  if (!activity.startDate) {
    if (
      activity.type === 'RECURRING' &&
      activity.schedule &&
      typeof activity.schedule === 'object' &&
      !Array.isArray(activity.schedule)
    ) {
      const sch = activity.schedule as { days?: unknown };
      if (Array.isArray(sch.days)) {
        const days = sch.days.filter((d): d is string => typeof d === 'string');
        return formatScheduleDays(days);
      }
    }
    return null;
  }

  const start    = new Date(activity.startDate);
  const startCol = toColDate(start);

  const end    = activity.endDate ? new Date(activity.endDate) : null;
  const endCol = end ? toColDate(end) : null;

  // Número de días entre hoy y el inicio (en COL, ignorando hora)
  const todayMidnight = Date.UTC(
    nowCol.getUTCFullYear(), nowCol.getUTCMonth(), nowCol.getUTCDate(),
  );
  const startMidnight = Date.UTC(
    startCol.getUTCFullYear(), startCol.getUTCMonth(), startCol.getUTCDate(),
  );
  const diffDays = Math.round((startMidnight - todayMidnight) / 86_400_000);

  // Eventos pasados → el badge EXPIRED maneja esto; aquí no mostramos nada
  if (diffDays < 0) return null;

  // ── Hoy ──────────────────────────────────────────────────────────────────────
  if (diffDays === 0) {
    const h = startCol.getUTCHours();
    const m = startCol.getUTCMinutes();
    // Medianoche = sin hora específica (solo fecha)
    if (h !== 0 || m !== 0) return `Hoy · ${formatColTime(h, m)}`;
    return 'Hoy';
  }

  // ── Mañana ───────────────────────────────────────────────────────────────────
  if (diffDays === 1) return 'Mañana';

  // ── Dentro de 7 días ──────────────────────────────────────────────────────────
  if (diffDays < 7) {
    const dow = startCol.getUTCDay(); // 0=Dom, 6=Sáb
    // Fin de semana próximo
    if (dow === 0 || dow === 6) return 'Este fin de semana';
    // Día de la semana con número
    return `${DAY_NAMES[dow]} ${startCol.getUTCDate()}`;
  }

  // ── Evento multi-día dentro del mismo mes ────────────────────────────────────
  if (endCol && !isSameColDay(startCol, endCol)) {
    if (startCol.getUTCMonth() === endCol.getUTCMonth()) {
      const mon = MONTH_NAMES[startCol.getUTCMonth()];
      return `${startCol.getUTCDate()}–${endCol.getUTCDate()} ${mon}`;
    }
  }

  // ── Fecha futura (> 7 días) ──────────────────────────────────────────────────
  return `${startCol.getUTCDate()} ${MONTH_NAMES[startCol.getUTCMonth()]}`;
}
