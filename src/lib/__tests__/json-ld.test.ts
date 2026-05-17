// =============================================================================
// json-ld.test.ts — Tests de safeJsonLd()
// =============================================================================

import { describe, it, expect } from 'vitest'
import { safeJsonLd } from '../json-ld'

describe('safeJsonLd', () => {
  it('serializa un objeto simple correctamente', () => {
    const result = safeJsonLd({ '@type': 'Event', name: 'Taller de pintura' })
    expect(JSON.parse(result)).toEqual({ '@type': 'Event', name: 'Taller de pintura' })
  })

  it('escapa </script> para prevenir XSS', () => {
    const malicious = { title: 'Hola</script><script>alert(1)</script>' }
    const result = safeJsonLd(malicious)
    // El HTML parser nunca verá </script> como cierre de tag
    expect(result).not.toContain('</script>')
    expect(result).toContain('<\\/script>')
    // El JSON resultante sigue siendo parseable y el valor se recupera correctamente
    expect(JSON.parse(result).title).toBe('Hola</script><script>alert(1)</script>')
  })

  it('no altera <!-- (no es un escape JSON válido; la amenaza es mitigada por CSP)', () => {
    // "<!--" no se escapa porque "\!" es inválido en JSON (solo "\/" es válido).
    // El riesgo de inyección de comentarios HTML es menor y cubierto por CSP.
    const data = { desc: '<!-- comentario -->' }
    const result = safeJsonLd(data)
    expect(JSON.parse(result).desc).toBe('<!-- comentario -->')
  })

  it('escapa múltiples ocurrencias en el mismo string', () => {
    const data = { a: '</script>uno</script>dos</script>' }
    const result = safeJsonLd(data)
    expect(result.match(/<\/script>/g)).toBeNull()
    expect(result.match(/<\\\/script>/g)).toHaveLength(3)
  })

  it('no altera datos que no contienen secuencias peligrosas', () => {
    const safe = { name: 'Taller para niños', price: 0, tags: ['arte', 'música'] }
    const result = safeJsonLd(safe)
    expect(JSON.parse(result)).toEqual(safe)
  })

  it('maneja null, arrays y valores primitivos', () => {
    expect(JSON.parse(safeJsonLd(null))).toBeNull()
    expect(JSON.parse(safeJsonLd([1, 2, 3]))).toEqual([1, 2, 3])
    expect(JSON.parse(safeJsonLd(42))).toBe(42)
  })

  it('escapa </script> en campos anidados y recupera el valor original', () => {
    const nested = {
      organizer: { name: 'Club</script>Bogotá' },
      location: { address: { streetAddress: 'Calle 80 #10-20' } },
    }
    const result = safeJsonLd(nested)
    expect(result).not.toContain('</script>')
    const parsed = JSON.parse(result)
    expect(parsed.organizer.name).toBe('Club</script>Bogotá')
    expect(parsed.location.address.streetAddress).toBe('Calle 80 #10-20')
  })
})
