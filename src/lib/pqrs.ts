/**
 * Constantes y tipos compartidos para el módulo PQRS (Ley 1581 / SIC).
 *
 * Este archivo es la fuente de verdad para cualquier valor controlado
 * relacionado con solicitudes de contacto y derechos de datos.
 *
 * Usar siempre estas constantes en rutas API, scripts y componentes
 * para garantizar consistencia en auditorías y reportes.
 */

// ---------------------------------------------------------------------------
// Canal por el que el equipo dio la primera respuesta a una PQRS.
// Refleja el campo ContactRequest.responseChannel (String? en BD).
//
// Cuando construyas el endpoint admin PQRS (PATCH /api/admin/pqrs/:id),
// úsalo directamente con Zod para cerrar compile-time + runtime:
//
//   import { RESPONSE_CHANNELS } from '@/lib/pqrs';
//   const bodySchema = z.object({
//     responseChannel: z.enum(RESPONSE_CHANNELS).optional(),
//     firstRespondedAt: z.string().datetime().optional(),
//   });
// ---------------------------------------------------------------------------
export const RESPONSE_CHANNELS = [
  'email',     // Correo electrónico directo
  'phone',     // Llamada telefónica
  'whatsapp',  // WhatsApp
  'manual',    // Gestión interna sin contacto externo directo (e.g. cierre automático)
  'platform',  // Respuesta dentro de la plataforma HabitaPlan
] as const;

export type ResponseChannel = (typeof RESPONSE_CHANNELS)[number];

// ---------------------------------------------------------------------------
// Categorías de solicitud de contacto.
// Deben coincidir con los valores aceptados en POST /api/contact.
//
// Úsalo con Zod en cualquier endpoint que reciba/valide categorías:
//   category: z.enum(CONTACT_CATEGORIES)
// ---------------------------------------------------------------------------
export const CONTACT_CATEGORIES = [
  'general',
  'content_removal',
  'data_access',
  'data_claim',
  'report_error',
  'other',
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// SLA en días hábiles por categoría (Circular SIC + política interna).
// Nota: No incluye festivos colombianos — para precisión 100% legal
// se requeriría integrar una API de festivos.
// ---------------------------------------------------------------------------
export const PQRS_SLA: Record<ContactCategory, { alertAt: number; limit: number }> = {
  data_access:     { alertAt: 8,  limit: 10 }, // Ley 1581
  data_claim:      { alertAt: 13, limit: 15 }, // Ley 1581
  general:         { alertAt: 3,  limit: 5  }, // SLA interno
  content_removal: { alertAt: 3,  limit: 5  }, // SLA interno
  report_error:    { alertAt: 3,  limit: 5  }, // SLA interno
  other:           { alertAt: 3,  limit: 5  }, // SLA interno
};

// ---------------------------------------------------------------------------
// Utilidades de SLA — usadas por check-overdue-pqrs y GET /api/admin/pqrs
// ---------------------------------------------------------------------------

export type SlaLevel = 'WARNING' | 'DUE_TODAY' | 'OVERDUE';

/** Días hábiles (lun–vie) entre dos fechas, sin contar festivos colombianos. */
export function getBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const cur = new Date(startDate.getTime());
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate.getTime());
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(0, count - 1);
}

/** Clasifica una PQRS según días hábiles transcurridos y su SLA. */
export function classifySla(
  businessDays: number,
  category: string,
): { level: SlaLevel | null; limit: number } {
  const sla = PQRS_SLA[category as ContactCategory] ?? PQRS_SLA.general;
  if (businessDays > sla.limit)    return { level: 'OVERDUE',   limit: sla.limit };
  if (businessDays === sla.limit)  return { level: 'DUE_TODAY', limit: sla.limit };
  if (businessDays >= sla.alertAt) return { level: 'WARNING',   limit: sla.limit };
  return { level: null, limit: sla.limit };
}
