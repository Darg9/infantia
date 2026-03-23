'use client'

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'infantia:activity-history'
const MAX_ITEMS = 50

export interface HistoryEntry {
  activityId: string
  title: string
  imageUrl: string | null
  viewedAt: string // ISO string
}

function getSnapshot(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function getServerSnapshot(): HistoryEntry[] {
  return []
}

// Notify listeners when storage changes
let listeners: Array<() => void> = []
function emitChange() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

export function addToHistory(entry: Omit<HistoryEntry, 'viewedAt'>) {
  if (typeof window === 'undefined') return
  try {
    const history = getSnapshot()
    const filtered = history.filter((h) => h.activityId !== entry.activityId)
    const newEntry: HistoryEntry = { ...entry, viewedAt: new Date().toISOString() }
    const updated = [newEntry, ...filtered].slice(0, MAX_ITEMS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    emitChange()
  } catch {
    // Storage full or unavailable
  }
}

export function clearHistory() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  emitChange()
}

export function useActivityHistory() {
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return {
    history,
    addToHistory: useCallback(addToHistory, []),
    clearHistory: useCallback(clearHistory, []),
  }
}
