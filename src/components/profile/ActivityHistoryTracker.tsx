'use client'

import { useEffect } from 'react'
import { addToHistory } from '@/hooks/useActivityHistory'

interface ActivityHistoryTrackerProps {
  activityId: string
  title: string
  imageUrl: string | null
}

export function ActivityHistoryTracker({ activityId, title, imageUrl }: ActivityHistoryTrackerProps) {
  useEffect(() => {
    // Historial local (localStorage)
    addToHistory({ activityId, title, imageUrl });

    // Registro anónimo de vista en el servidor (fire-and-forget)
    fetch(`/api/activities/${activityId}/view`, { method: 'POST' }).catch(() => {});
  }, [activityId, title, imageUrl])

  return null
}
