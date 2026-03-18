import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Política de privacidad de Infantia. Conoce cómo protegemos tu información personal.',
};

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Política de Privacidad</h1>
      <p className="text-sm text-gray-400 mb-8">Última actualización: 17 de marzo de 2026</p>

      <div className="prose prose-gray prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-gray-800">1. Responsable del tratamiento</h2>
          <p className="text-gray-600 leading-relaxed">
            <strong>Infantia</strong> es un proyecto operado por Denys Reyes, con domicilio en Bogotá, Colombia.
            Para cualquier consulta relacionada con el tratamiento de sus datos personales, puede escribirnos a
            través de nuestra <Link href="/contacto" className="text-orange-600 hover:underline">página de contacto</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">2. Información que recopilamos</h2>
          <p className="text-gray-600 leading-relaxed">
            <strong>Datos proporcionados por el usuario:</strong>
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Correo electrónico (al registrarse)</li>
            <li>Contraseña (almacenada de forma cifrada)</li>
            <li>Nombre (si lo proporciona voluntariamente)</li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-3">
            <strong>Datos recopilados automáticamente:</strong>
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Dirección IP</li>
            <li>Tipo de navegador y dispositivo</li>
            <li>Páginas visitadas dentro del sitio</li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-3">
            <strong>No recopilamos:</strong> datos de menores de edad, datos sensibles (origen étnico, salud,
            orientación sexual), ni datos biométricos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">3. Finalidad del tratamiento</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Gestionar su cuenta de usuario</li>
            <li>Permitir el acceso a funcionalidades del sitio</li>
            <li>Enviar comunicaciones relacionadas con el servicio (si las autoriza)</li>
            <li>Mejorar la experiencia de uso de la plataforma</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">4. Base legal</h2>
          <p className="text-gray-600 leading-relaxed">
            El tratamiento de sus datos se realiza con base en su <strong>autorización expresa</strong> otorgada
            al momento del registro, de conformidad con la Ley 1581 de 2012 y el Decreto 1377 de 2013.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">5. Información de actividades</h2>
          <p className="text-gray-600 leading-relaxed">
            Infantia recopila información sobre actividades, talleres y eventos de <strong>fuentes públicamente
            accesibles</strong> (sitios web de entidades públicas, redes sociales de organizaciones culturales).
            Esta información es de carácter factual (nombres, fechas, horarios, ubicaciones, precios) y se
            presenta con <strong>atribución explícita</strong> a la fuente original.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Si usted es titular de contenido publicado en Infantia y desea su modificación o remoción,
            puede solicitarlo a través de nuestra{' '}
            <Link href="/contacto" className="text-orange-600 hover:underline">página de contacto</Link>.
            Nos comprometemos a responder en un plazo máximo de 15 días hábiles.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">6. Sus derechos</h2>
          <p className="text-gray-600 leading-relaxed">
            De acuerdo con la Ley 1581 de 2012, usted tiene derecho a:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li><strong>Acceder</strong> a sus datos personales</li>
            <li><strong>Rectificar</strong> información inexacta o incompleta</li>
            <li><strong>Cancelar</strong> (eliminar) sus datos de nuestra base</li>
            <li><strong>Oponerse</strong> al tratamiento de sus datos</li>
            <li><strong>Revocar</strong> la autorización previamente otorgada</li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-2">
            Para ejercer estos derechos, escriba a través de nuestra{' '}
            <Link href="/contacto" className="text-orange-600 hover:underline">página de contacto</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">7. Seguridad</h2>
          <p className="text-gray-600 leading-relaxed">
            Utilizamos medidas de seguridad técnicas y organizativas para proteger sus datos, incluyendo:
            cifrado de contraseñas, conexiones HTTPS, almacenamiento en servidores seguros (Supabase/AWS)
            y acceso restringido a la información.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">8. Terceros</h2>
          <p className="text-gray-600 leading-relaxed">
            Sus datos pueden ser procesados por los siguientes proveedores de servicios, quienes cuentan
            con sus propias políticas de protección de datos:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li><strong>Supabase</strong> — Autenticación y base de datos (servidores en EE.UU.)</li>
            <li><strong>Vercel</strong> — Alojamiento web (servidores en EE.UU.)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">9. Cambios a esta política</h2>
          <p className="text-gray-600 leading-relaxed">
            Nos reservamos el derecho de modificar esta política. Los cambios serán publicados en esta
            página con la fecha de actualización. El uso continuado del sitio después de los cambios
            constituye aceptación de la política actualizada.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">10. Contacto y reclamaciones</h2>
          <p className="text-gray-600 leading-relaxed">
            Para consultas, reclamos o ejercicio de sus derechos:{' '}
            <Link href="/contacto" className="text-orange-600 hover:underline">página de contacto</Link>.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Si considera que el tratamiento de sus datos vulnera la normativa vigente, puede presentar
            una queja ante la <strong>Superintendencia de Industria y Comercio (SIC)</strong>:{' '}
            <span className="text-gray-500">www.sic.gov.co</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
