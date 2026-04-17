interface ToggleFavoriteParams {
  targetId: string
  type: 'activity' | 'place'
  expectLike: boolean
}

export async function toggleFavorite({ targetId, type, expectLike }: ToggleFavoriteParams): Promise<Response> {
  if (!expectLike) {
    return fetch(`/api/favorites/${targetId}?type=${type}`, { method: 'DELETE' })
  } else {
    return fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, type }),
    })
  }
}
