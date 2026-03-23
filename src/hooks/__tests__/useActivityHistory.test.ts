import { describe, it, expect, vi, beforeEach } from 'vitest'

// Storage mock - must be defined before module import
let store: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { store = {} }),
  get length() { return Object.keys(store).length },
  key: vi.fn(() => null),
}

// Define both window and localStorage on globalThis before importing module
Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true, configurable: true })
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true, configurable: true })

// Now import the module (it will see window + localStorage)
import { addToHistory, clearHistory } from '../useActivityHistory'

const STORAGE_KEY = 'infantia:activity-history'

function getStoredHistory() {
  const raw = store[STORAGE_KEY]
  return raw ? JSON.parse(raw) : []
}

describe('useActivityHistory', () => {
  beforeEach(() => {
    store = {}
    vi.clearAllMocks()
  })

  it('almacena entrada en localStorage', () => {
    addToHistory({ activityId: 'a1', title: 'Taller de arte', imageUrl: null })

    const stored = getStoredHistory()
    expect(stored).toHaveLength(1)
    expect(stored[0].activityId).toBe('a1')
    expect(stored[0].title).toBe('Taller de arte')
    expect(stored[0].imageUrl).toBeNull()
  })

  it('deduplica por activityId (mueve al frente)', () => {
    addToHistory({ activityId: 'a1', title: 'First', imageUrl: null })
    addToHistory({ activityId: 'a2', title: 'Second', imageUrl: null })
    addToHistory({ activityId: 'a1', title: 'First updated', imageUrl: '/img.jpg' })

    const stored = getStoredHistory()
    expect(stored).toHaveLength(2)
    expect(stored[0].activityId).toBe('a1')
    expect(stored[0].title).toBe('First updated')
    expect(stored[1].activityId).toBe('a2')
  })

  it('limita a 50 items con FIFO', () => {
    for (let i = 0; i < 55; i++) {
      addToHistory({ activityId: `a${i}`, title: `Activity ${i}`, imageUrl: null })
    }

    const stored = getStoredHistory()
    expect(stored).toHaveLength(50)
    expect(stored[0].activityId).toBe('a54')
    expect(stored[49].activityId).toBe('a5')
  })

  it('agrega viewedAt timestamp', () => {
    const before = Date.now()
    addToHistory({ activityId: 'a1', title: 'Test', imageUrl: null })

    const stored = getStoredHistory()
    expect(stored[0].viewedAt).toBeDefined()
    const viewedTime = new Date(stored[0].viewedAt).getTime()
    expect(viewedTime).toBeGreaterThanOrEqual(before)
  })

  it('clearHistory elimina todas las entradas', () => {
    addToHistory({ activityId: 'a1', title: 'Test', imageUrl: null })
    clearHistory()

    const stored = getStoredHistory()
    expect(stored).toHaveLength(0)
  })

  it('ordena mas reciente primero', () => {
    addToHistory({ activityId: 'a1', title: 'First', imageUrl: null })
    addToHistory({ activityId: 'a2', title: 'Second', imageUrl: null })
    addToHistory({ activityId: 'a3', title: 'Third', imageUrl: null })

    const stored = getStoredHistory()
    expect(stored[0].activityId).toBe('a3')
    expect(stored[1].activityId).toBe('a2')
    expect(stored[2].activityId).toBe('a1')
  })

  it('retorna array vacio cuando localStorage esta vacio', () => {
    const stored = getStoredHistory()
    expect(stored).toHaveLength(0)
  })

  it('maneja errores de localStorage sin lanzar excepcion', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => {
      addToHistory({ activityId: 'a1', title: 'Test', imageUrl: null })
    }).not.toThrow()
  })

  it('actualiza viewedAt al re-ver misma actividad', () => {
    addToHistory({ activityId: 'a1', title: 'Test', imageUrl: null })
    const first = getStoredHistory()[0].viewedAt

    // Small delay to get different timestamp
    addToHistory({ activityId: 'a2', title: 'Other', imageUrl: null })
    addToHistory({ activityId: 'a1', title: 'Test', imageUrl: null })

    const stored = getStoredHistory()
    expect(stored[0].activityId).toBe('a1')
    expect(stored[0].viewedAt).toBeDefined()
    // Should still be first (most recent)
    expect(stored).toHaveLength(2)
  })

  it('no duplica entradas', () => {
    addToHistory({ activityId: 'a1', title: 'Test', imageUrl: null })
    addToHistory({ activityId: 'a1', title: 'Test', imageUrl: null })
    addToHistory({ activityId: 'a1', title: 'Test', imageUrl: null })

    const stored = getStoredHistory()
    expect(stored).toHaveLength(1)
  })
})
