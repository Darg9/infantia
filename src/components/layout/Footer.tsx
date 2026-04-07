import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Brand */}
          <div>
            <span className="text-lg font-bold text-orange-500">HabitaPlan</span>
            <p className="text-sm text-gray-500 mt-1">
              Actividades para niños y familias en Colombia.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Explorar</h3>
            <ul className="space-y-1">
              <li>
                <Link href="/actividades" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Actividades
                </Link>
              </li>
              <li>
                <Link href="/contribuir" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Contribuir
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Contacto
                </Link>
              </li>
              <li>
                <Link href="/anunciate" className="text-sm text-orange-500 font-medium hover:text-orange-600 transition-colors">
                  Anúnciate
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Legal</h3>
            <ul className="space-y-1">
              <li>
                <Link href="/privacidad" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Privacidad
                </Link>
              </li>
              <li>
                <Link href="/tratamiento-datos" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Tratamiento de datos
                </Link>
              </li>
              <li>
                <Link href="/terminos" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Términos de uso
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-6 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} HabitaPlan. Bogotá, Colombia.</span>
          <span>
            La información proviene de fuentes públicas.{' '}
            <Link href="/contacto" className="underline hover:text-gray-600">
              Solicitar corrección o remoción
            </Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
