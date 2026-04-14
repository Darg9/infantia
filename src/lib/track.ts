// In-memory Anti-Spam (Throttle) temporal cache
const lastEventMap = new Map<string, number>();

function shouldTrack(key: string, delay: number) {
  const now = Date.now();
  const last = lastEventMap.get(key);

  if (last && now - last < delay) {
    return false;
  }

  // Update in throttle registry
  lastEventMap.set(key, now);
  
  // Limpiar llaves residuales para evitar Mem-leak si la sesion es muy prolongada (opcional pero util en SPA)
  if (lastEventMap.size > 500) lastEventMap.clear();

  return true;
}

export async function trackEvent({
  type,
  activityId,
  path,
  metadata
}: {
  type: string;
  activityId?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    let delay = 0;

    if (type === "activity_click") delay = 500;
    if (type === "outbound_click") delay = 1000;

    const key = `${type}:${activityId || path || "global"}`;

    if (delay > 0 && !shouldTrack(key, delay)) {
      return; // Bloqueo temporal Anti-Spam Throttled
    }

    await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      // Habilitar keepalive para asegurar envio al cambiar de ruta
      keepalive: true, 
      body: JSON.stringify({
        type,
        activityId,
        path,
        metadata
      })
    });

  } catch (e) {
    // fail silently para no afectar performance UX ni crashear arbol de render...
    // console.warn('Silenced Event Error');
  }
}
