'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { IntentManager } from '@/lib/intent-manager'
import { useToast } from '@/components/ui/toast'
import { toggleFavorite } from '@/modules/favorites/toggle-favorite'

export default function IntentResolver() {
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const run = async () => {
      const intent = IntentManager.consume()
      if (!intent) return

      try {
        // Micro-delay para asegurar sesión/cookies asíncronas en browser 
        await new Promise((r) => setTimeout(r, 50))

        switch (intent.type) {
          case 'NAVIGATE': {
            router.replace(intent.to)
            return
          }

          case 'TOGGLE_FAVORITE': {
            await toggleFavorite({
              targetId: intent.targetId,
              type: intent.targetType,
              expectLike: true // Intent siempre asume que queremos guardarlo (al darle auth)
            })

            toast.success('Guardado en favoritos', {
              action: {
                label: 'Ver favoritos →',
                href: '/perfil/favoritos',
              },
            })

            router.replace(intent.returnTo)
            return
          }

          case 'RATE': {
            const res = await fetch('/api/ratings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                activityId: intent.activityId,
                score: intent.score,
                comment: intent.comment ?? null,
              }),
            })
            if (res.ok) {
              toast.success('¡Calificación enviada! ✓')
            } else {
              toast.error('No se pudo guardar la calificación')
            }
            router.replace(intent.returnTo)
            return
          }

          case 'GENERIC_ACTION': {
            router.replace(intent.returnTo ?? '/')
            return
          }

          default:
            return
        }
      } catch (err) {
        // No romper flujo de login si falla la acción
         
        console.error('[IntentResolver]', err)
        router.replace('/')
      }
    }

    run()
  }, [router, toast]) // ← CRÍTICO: array de dependencias estable (solo una vez en la práctica por montaje global)

  return null
}
