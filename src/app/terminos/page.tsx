import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos de Uso',
  description: 'Términos y condiciones de uso de la plataforma Infantia.',
};

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Términos de Uso</h1>
      <p className="text-sm text-gray-400 mb-8">Última actualización: 17 de marzo de 2026</p>

      <div className="prose prose-gray prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-gray-800">1. Aceptación</h2>
          <p className="text-gray-600 leading-relaxed">
            Al acceder y utilizar Infantia, usted acepta estos términos de uso. Si no está de acuerdo
            con alguna de estas condiciones, le pedimos que no utilice el sitio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">2. Descripción del servicio</h2>
          <p className="text-gray-600 leading-relaxed">
            Infantia es una plataforma de descubrimiento de actividades, talleres, eventos y cursos para
            niños y familias. La información presentada proviene de múltiples fuentes públicas y se ofrece
            con fines exclusivamente informativos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">3. Naturaleza de la información</h2>
          <p className="text-gray-600 leading-relaxed">
            La información sobre actividades que se presenta en Infantia es recopilada de{' '}
            <strong>fuentes públicamente accesibles</strong>, incluyendo sitios web de entidades públicas,
            organizaciones culturales y educativas. Infantia:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li><strong>No es el organizador</strong> de las actividades listadas</li>
            <li><strong>No garantiza</strong> la exactitud, vigencia o disponibilidad de la información</li>
            <li><strong>No se responsabiliza</strong> por cambios de horario, cancelaciones o modificaciones
              realizadas por los organizadores</li>
            <li>Proporciona <strong>enlaces directos a la fuente original</strong> para que el usuario
              pueda verificar la información</li>
          </ul>
          <p className="text-gray-600 leading-relaxed">
            Recomendamos siempre confirmar los detalles directamente con el organizador antes de asistir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">4. Propiedad intelectual</h2>
          <p className="text-gray-600 leading-relaxed">
            Los derechos sobre el contenido original de las actividades (descripciones, imágenes, logotipos)
            pertenecen a sus respectivos titulares. Infantia presenta esta información con fines informativos
            y de difusión, siempre con <strong>atribución explícita</strong> a la fuente original.
          </p>
          <p className="text-gray-600 leading-relaxed">
            El diseño, código fuente, marca y estructura de la plataforma Infantia son propiedad de sus creadores.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Si usted es titular de contenido presentado en Infantia y desea su modificación o remoción,
            puede solicitarlo en nuestra{' '}
            <Link href="/contacto" className="text-orange-600 hover:underline">página de contacto</Link>.
            Nos comprometemos a atender su solicitud en un plazo máximo de <strong>5 días hábiles</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">5. Solicitud de remoción de contenido</h2>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-gray-700 leading-relaxed">
              Si usted es el titular o representante autorizado de una organización cuyo contenido aparece
              en Infantia y desea que sea removido, puede enviar una solicitud a través de nuestro{' '}
              <Link href="/contacto" className="text-orange-600 font-medium hover:underline">formulario de contacto</Link>{' '}
              seleccionando la opción <strong>&quot;Solicitud de remoción de contenido&quot;</strong>.
            </p>
            <p className="text-gray-700 leading-relaxed mt-2">
              Requerimos: nombre del solicitante, organización que representa, URL del contenido en Infantia,
              y motivo de la solicitud. Responderemos en un máximo de <strong>5 días hábiles</strong>.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">6. Uso aceptable</h2>
          <p className="text-gray-600 leading-relaxed">Al usar Infantia, usted se compromete a:</p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>No utilizar el sitio para fines ilegales</li>
            <li>No intentar acceder a áreas restringidas sin autorización</li>
            <li>No realizar scraping automatizado del sitio sin autorización previa</li>
            <li>Proporcionar información veraz al registrarse</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">7. Cuentas de usuario</h2>
          <p className="text-gray-600 leading-relaxed">
            El registro es gratuito y voluntario. Usted es responsable de mantener la confidencialidad
            de sus credenciales. Puede solicitar la eliminación de su cuenta en cualquier momento a través
            de la <Link href="/contacto" className="text-orange-600 hover:underline">página de contacto</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">8. Limitación de responsabilidad</h2>
          <p className="text-gray-600 leading-relaxed">
            Infantia se proporciona &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No ofrecemos garantías
            de ningún tipo, expresas o implícitas, sobre la exactitud, confiabilidad o disponibilidad del
            servicio. En la máxima medida permitida por la ley, Infantia no será responsable por daños
            directos, indirectos o consecuentes derivados del uso del sitio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">9. Modificaciones</h2>
          <p className="text-gray-600 leading-relaxed">
            Nos reservamos el derecho de modificar estos términos. Los cambios serán publicados en esta
            página con la fecha de actualización.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">10. Ley aplicable</h2>
          <p className="text-gray-600 leading-relaxed">
            Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia
            será sometida a la jurisdicción de los tribunales de Bogotá D.C.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">11. Contacto</h2>
          <p className="text-gray-600 leading-relaxed">
            Para preguntas sobre estos términos:{' '}
            <Link href="/contacto" className="text-orange-600 hover:underline">página de contacto</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
