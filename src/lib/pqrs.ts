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
