import { describe, it, expect, vi } from 'vitest'
import { render } from '@react-email/components'
import { ActivityDigestEmail } from '../activity-digest'

// activity-url mock
vi.mock('@/lib/activity-url', () => ({
  activityPath: (id: string, title: string) => `/actividades/${id}-${title.toLowerCase().replace(/\s+/g, '-')}`,
}))

const BASE_URL = 'https://infantia-activities.vercel.app'

const ACTIVITIES = [
  {
    id: 'act-1',
    title: 'Taller de arte',
    description: 'Un taller creativo para niños.',
    price: null,
    priceLabel: 'Gratis',
    minAge: 5,
    maxAge: 12,
  },
  {
    id: 'act-2',
    title: 'Curso de robótica',
    description: 'Introducción a la robótica.',
    price: 50000,
    priceLabel: '$50.000',
    minAge: 8,
    maxAge: null,
  },
]

async function renderEmail(props: Parameters<typeof ActivityDigestEmail>[0]) {
  return render(<ActivityDigestEmail {...props} />)
}

describe('ActivityDigestEmail', () => {
  describe('UTM tracking — links de actividades', () => {
    it('incluye UTM en el link "Ver detalles" de cada actividad (daily)', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'daily' })
      expect(html).toContain('utm_source=infantia')
      expect(html).toContain('utm_medium=email')
      expect(html).toContain('utm_campaign=digest_daily')
    })

    it('incluye UTM en el link "Ver detalles" de cada actividad (weekly)', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'weekly' })
      expect(html).toContain('utm_campaign=digest_weekly')
    })

    it('incluye UTM en el link "Ver todas las actividades"', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'daily' })
      expect(html).toContain('/actividades?utm_source=infantia&amp;utm_medium=email&amp;utm_campaign=digest_daily')
    })

    it('los links de actividad apuntan a la URL correcta con UTM', async () => {
      const html = await renderEmail({ activities: [ACTIVITIES[0]], period: 'daily' })
      expect(html).toContain('/actividades/act-1-taller-de-arte?utm_source=infantia')
    })
  })

  describe('Bloque patrocinador', () => {
    const sponsor = {
      name: 'Acme Corp',
      tagline: 'Calidad garantizada',
      url: 'https://acme.com',
    }

    it('no renderiza bloque sponsor si no se pasa prop', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'daily' })
      expect(html).not.toContain('Patrocinado por')
    })

    it('renderiza bloque sponsor si se pasa prop', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'daily', sponsor })
      expect(html).toContain('Patrocinado por')
      expect(html).toContain('Acme Corp')
      expect(html).toContain('Calidad garantizada')
    })

    it('incluye UTM en el link del sponsor', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'daily', sponsor })
      expect(html).toContain('utm_source=infantia')
      expect(html).toContain('utm_medium=email')
      expect(html).toContain('utm_campaign=newsletter')
    })

    it('no renderiza img si sponsor no tiene logoUrl', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'daily', sponsor })
      // sin logoUrl no debe haber img con src del sponsor
      expect(html).not.toContain('acme.com/logo')
    })

    it('renderiza img si sponsor tiene logoUrl', async () => {
      const withLogo = { ...sponsor, logoUrl: 'https://acme.com/logo.png' }
      const html = await renderEmail({ activities: ACTIVITIES, period: 'daily', sponsor: withLogo })
      expect(html).toContain('acme.com/logo.png')
    })
  })

  describe('Contenido base', () => {
    it('muestra nombre del usuario', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'daily', userName: 'Denys' })
      expect(html).toContain('Denys')
    })

    it('muestra número de actividades en el subject/preview', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'daily' })
      expect(html).toContain('2')
    })

    it('usa "hoy" para período daily', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'daily' })
      expect(html).toContain('hoy')
    })

    it('usa "esta semana" para período weekly', async () => {
      const html = await renderEmail({ activities: ACTIVITIES, period: 'weekly' })
      expect(html).toContain('esta semana')
    })

    it('trunca descripción a 120 caracteres', async () => {
      const longDesc = 'A'.repeat(200)
      const html = await renderEmail({
        activities: [{ ...ACTIVITIES[0], description: longDesc }],
        period: 'daily',
      })
      expect(html).toContain('...')
    })
  })
})
