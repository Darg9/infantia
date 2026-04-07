import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Tratamiento de Datos Personales',
  description: 'Política de tratamiento de datos personales de HabitaPlan conforme a la Ley 1581 de 2012.',
};

export default function TratamientoDatosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Política de Tratamiento de Datos Personales</h1>
      <p className="text-sm text-gray-500 mb-1">Conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013</p>
      <p className="text-sm text-gray-400 mb-8">Última actualización: 17 de marzo de 2026</p>

      <div className="prose prose-gray prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-gray-800">1. Identificación del responsable</h2>
          <table className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg overflow-hidden">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2 font-medium bg-gray-50 w-1/3">Responsable</td>
                <td className="px-3 py-2">Denys Reyes</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2 font-medium bg-gray-50">Proyecto</td>
                <td className="px-3 py-2">HabitaPlan</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2 font-medium bg-gray-50">Domicilio</td>
                <td className="px-3 py-2">Bogotá D.C., Colombia</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium bg-gray-50">Canal de atención</td>
                <td className="px-3 py-2">
                  <Link href="/contacto" className="text-orange-600 hover:underline">Página de contacto</Link>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">2. Marco normativo</h2>
          <p className="text-gray-600 leading-relaxed">
            Esta política se rige por:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Constitución Política de Colombia, artículo 15 (derecho a la intimidad y habeas data)</li>
            <li>Ley Estatutaria 1581 de 2012 (Protección de Datos Personales)</li>
            <li>Decreto 1377 de 2013 (Reglamentario de la Ley 1581)</li>
            <li>Decreto 886 de 2014 (Registro Nacional de Bases de Datos)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">3. Definiciones</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li><strong>Dato personal:</strong> cualquier información vinculada a una persona natural</li>
            <li><strong>Titular:</strong> persona natural cuyos datos personales son objeto de tratamiento</li>
            <li><strong>Tratamiento:</strong> cualquier operación sobre datos personales (recolección, almacenamiento, uso, circulación, supresión)</li>
            <li><strong>Responsable:</strong> quien decide sobre la base de datos y su tratamiento</li>
            <li><strong>Autorización:</strong> consentimiento previo, expreso e informado del titular</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">4. Datos que recopilamos</h2>
          <table className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-medium">Dato</th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-left font-medium">Finalidad</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">Correo electrónico</td>
                <td className="px-3 py-2">Personal</td>
                <td className="px-3 py-2">Registro, autenticación, comunicaciones</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">Contraseña</td>
                <td className="px-3 py-2">Personal (cifrado)</td>
                <td className="px-3 py-2">Autenticación</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">Nombre</td>
                <td className="px-3 py-2">Personal (opcional)</td>
                <td className="px-3 py-2">Personalización del perfil</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">Dirección IP</td>
                <td className="px-3 py-2">Técnico</td>
                <td className="px-3 py-2">Seguridad, diagnóstico</td>
              </tr>
            </tbody>
          </table>
          <p className="text-gray-600 leading-relaxed mt-3">
            <strong>No recopilamos datos sensibles</strong> (Art. 5 Ley 1581): no tratamos datos sobre origen
            racial o étnico, orientación política, convicciones religiosas, pertenencia a sindicatos,
            salud, vida sexual, ni datos biométricos. <strong>No recopilamos datos de menores de edad.</strong>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">5. Finalidades del tratamiento</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Crear y gestionar la cuenta de usuario</li>
            <li>Autenticar el acceso al sitio</li>
            <li>Prestar los servicios de la plataforma (búsqueda y consulta de actividades)</li>
            <li>Enviar comunicaciones relacionadas con el servicio, previa autorización</li>
            <li>Generar estadísticas agregadas y anónimas de uso</li>
            <li>Atender consultas, peticiones, quejas y reclamos</li>
            <li>Cumplir obligaciones legales</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">6. Autorización</h2>
          <p className="text-gray-600 leading-relaxed">
            La recolección y tratamiento de datos personales requiere la <strong>autorización previa,
            expresa e informada</strong> del titular. Esta autorización se obtiene al momento del registro
            en la plataforma, mediante la aceptación expresa de esta política.
          </p>
          <p className="text-gray-600 leading-relaxed">
            El titular puede revocar su autorización en cualquier momento a través de nuestra{' '}
            <Link href="/contacto" className="text-orange-600 hover:underline">página de contacto</Link>,
            siempre que no exista un deber legal o contractual que impida la supresión de los datos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">7. Derechos del titular</h2>
          <p className="text-gray-600 leading-relaxed">
            Conforme al artículo 8 de la Ley 1581 de 2012, el titular tiene derecho a:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Conocer, actualizar y rectificar sus datos</li>
            <li>Solicitar prueba de la autorización otorgada</li>
            <li>Ser informado del uso que se ha dado a sus datos</li>
            <li>Presentar quejas ante la SIC por infracciones</li>
            <li>Revocar la autorización y/o solicitar la supresión de sus datos</li>
            <li>Acceder gratuitamente a sus datos personales</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">8. Procedimiento para ejercer derechos</h2>
          <ol className="list-decimal pl-5 text-gray-600 space-y-1">
            <li>Envíe su solicitud a través de la <Link href="/contacto" className="text-orange-600 hover:underline">página de contacto</Link>, indicando: nombre completo, correo electrónico registrado, descripción de la solicitud y documentos de soporte si aplica.</li>
            <li>Las <strong>consultas</strong> serán atendidas en un plazo máximo de 10 días hábiles (prorrogable por 5 días).</li>
            <li>Los <strong>reclamos</strong> serán atendidos en un plazo máximo de 15 días hábiles (prorrogable por 8 días).</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">9. Medidas de seguridad</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Contraseñas almacenadas con hash criptográfico (bcrypt)</li>
            <li>Comunicaciones cifradas mediante HTTPS/TLS</li>
            <li>Base de datos alojada en Supabase (infraestructura AWS con cifrado en reposo)</li>
            <li>Acceso administrativo restringido por roles</li>
            <li>Monitoreo de accesos no autorizados</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">10. Transferencia y transmisión de datos</h2>
          <p className="text-gray-600 leading-relaxed">
            Los datos pueden ser transmitidos a los siguientes encargados del tratamiento, exclusivamente
            para las finalidades descritas en esta política:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li><strong>Supabase Inc.</strong> (EE.UU.) — Almacenamiento y autenticación</li>
            <li><strong>Vercel Inc.</strong> (EE.UU.) — Alojamiento de la aplicación web</li>
          </ul>
          <p className="text-gray-600 leading-relaxed">
            Estos proveedores cumplen con estándares internacionales de protección de datos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">11. Vigencia</h2>
          <p className="text-gray-600 leading-relaxed">
            Los datos personales serán tratados mientras sea necesario para las finalidades descritas
            o mientras el titular no solicite su supresión. Las bases de datos tendrán vigencia mientras
            HabitaPlan desarrolle su objeto.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800">12. Autoridad de protección de datos</h2>
          <p className="text-gray-600 leading-relaxed">
            La autoridad de vigilancia en materia de protección de datos personales en Colombia es la{' '}
            <strong>Superintendencia de Industria y Comercio (SIC)</strong>.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Página web: www.sic.gov.co — Línea gratuita nacional: 018000-910165
          </p>
        </section>
      </div>
    </div>
  );
}
