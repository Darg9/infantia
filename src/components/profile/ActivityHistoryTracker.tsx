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
    addToHistory({ activityId, title, imageUrl })
  }, [activityId, title, imageUrl])

  return null
}
