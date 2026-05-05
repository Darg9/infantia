export type Intent =
  | { type: 'NAVIGATE'; to: string }
  | { type: 'TOGGLE_FAVORITE'; targetId: string; targetType: 'activity' | 'place'; returnTo: string }
  | { type: 'RATE'; activityId: string; score: number; comment?: string; returnTo: string }
  | { type: 'GENERIC_ACTION'; name: string; payload?: Record<string, unknown>; returnTo?: string }

const STORAGE_KEY = 'hp_intent'
const TTL_MS = 15 * 60 * 1000 // 15 mins

interface StoredIntent {
  intent: Intent
  timestamp: number
}

export const IntentManager = {
  save(intent: Intent): void {
    try {
      const data: StoredIntent = { intent, timestamp: Date.now() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Ignore silence
    }
  },

  consume(): Intent | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null

      IntentManager.clear()

      const data = JSON.parse(raw) as StoredIntent
      if (!data.intent || !data.timestamp) return null

      // Validate TTL
      if (Date.now() - data.timestamp > TTL_MS) {
        return null
      }

      return data.intent
    } catch {
      return null
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore silence
    }
  }
}
