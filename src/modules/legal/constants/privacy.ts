// =============================================================================
// Privacidad — Fuente de Verdad Única (Single Source of Truth)
// Usado sincronizadamente entre la UI y el PDF generado
// =============================================================================

export const PRIVACY_META = {
  lastUpdated: '11 de abril de 2026',
  version: 'v1.0',
  title: 'Política de Privacidad',
  brand: 'HabitaPlan',
  filename: 'politica-privacidad-habitaplan.pdf',
  applicableLaw: 'Ley 1581 de 2012 · Decreto 1377 de 2013',
};

export const PRIVACY_SUMMARY = [
  {
    title: 'No vendemos tus datos',
    description: 'Tu información no se comercializa. Solo se comparte con proveedores tecnológicos necesarios para operar la plataforma, bajo estándares de seguridad adecuados.',
  },
  {
    title: 'Protección de menores',
    description: 'En caso de registro de menores de edad, requerimos autorización previa del padre o tutor y registramos dicho consentimiento conforme a la normativa colombiana.',
  },
  {
    title: 'Control sobre tu información',
    description: 'Puedes solicitar la eliminación de tus datos personales en cualquier momento, sujeto a obligaciones legales de conservación.',
  },
  {
    title: 'Uso responsable de la información',
    description: 'La información dentro de la plataforma tiene fines informativos y no constituye asesoría profesional.',
  },
];

export const PRIVACY_SECTIONS = [
  {
    num: '1',
    title: 'Responsable del tratamiento',
    content: [
      {
        type: 'text' as const,
        text: 'HabitaPlan (en adelante, "la Plataforma") es responsable del tratamiento de los datos personales conforme a la legislación colombiana, incluyendo la Ley 1581 de 2012 y el Decreto 1377 de 2013.',
      },
    ],
  },
  {
    num: '2',
    title: 'Datos que recolectamos',
    content: [
      { type: 'text' as const, text: 'Podemos recolectar y tratar las siguientes categorías de datos:' },
      { type: 'bullet' as const, text: 'Datos de identificación (correo electrónico, nombre opcional)' },
      { type: 'bullet' as const, text: 'Datos de uso (interacciones dentro de la plataforma)' },
      { type: 'bullet' as const, text: 'Datos técnicos (dirección IP, dispositivo, navegador)' },
      { type: 'bullet' as const, text: 'Datos de configuración (preferencias del usuario)' },
      { type: 'text' as const, text: 'La Plataforma podrá recolectar y utilizar datos de interacción (como clics y navegación) y datos técnicos (como dirección IP, tipo de dispositivo y navegador) con fines de mejorar la relevancia del contenido, analizar el uso del servicio, y prevenir abusos o usos indebidos. Esta información se utiliza de forma agregada y no para identificación personal directa.' },
      { type: 'bullet' as const, text: 'Datos asociados a cuentas de menores bajo autorización parental (cuando aplique)' },
      { type: 'text' as const, text: 'No recolectamos datos sensibles de forma intencional.' },
    ],
  },
  {
    num: '3',
    title: 'Fuentes de información externas',
    content: [
      { type: 'text' as const, text: 'La Plataforma puede obtener información de fuentes públicas o de terceros para su organización y visualización dentro del servicio. Esta información tiene fines exclusivamente informativos y no implica que HabitaPlan avale, garantice ni sea responsable de su exactitud, disponibilidad o vigencia.' },
      { type: 'text' as const, text: 'Los derechos sobre dicha información pertenecen a sus respectivos titulares. HabitaPlan actúa como agregador informativo y no reclama derechos sobre el contenido externo.' },
    ],
  },
  {
    num: '4',
    title: 'Finalidad del tratamiento',
    content: [
      { type: 'text' as const, text: 'Los datos personales son utilizados para:' },
      { type: 'bullet' as const, text: 'Crear y gestionar cuentas de usuario' },
      { type: 'bullet' as const, text: 'Permitir el uso de la plataforma' },
      { type: 'bullet' as const, text: 'Personalizar la experiencia' },
      { type: 'bullet' as const, text: 'Garantizar la seguridad del servicio' },
      { type: 'bullet' as const, text: 'Generar métricas agregadas' },
      { type: 'bullet' as const, text: 'Atender consultas o solicitudes' },
      { type: 'bullet' as const, text: 'Envío de notificaciones push relacionadas con nuevas actividades o actualizaciones, previa autorización expresa del usuario' },
      { type: 'bullet' as const, text: 'Cumplir obligaciones legales' },
    ],
  },
  {
    num: '5',
    title: 'Tratamiento de datos de menores',
    content: [
      { type: 'text' as const, text: 'La Plataforma puede tratar datos personales de menores únicamente bajo:' },
      { type: 'bullet' as const, text: 'Autorización previa, expresa e informada del padre o tutor' },
      { type: 'bullet' as const, text: 'Registro verificable del consentimiento' },
      { type: 'bullet' as const, text: 'Uso limitado a las finalidades del servicio' },
      { type: 'text' as const, text: 'El padre o tutor actúa como representante del menor. El registro de menores de edad requiere un proceso de autorización parental verificable, el cual incluye el envío de una solicitud al padre o tutor, la aceptación expresa mediante un enlace seguro y el registro del consentimiento con fines de auditoría.' },
    ],
  },
  {
    num: '6',
    title: 'Compartición de datos',
    content: [
      { type: 'text' as const, text: 'HabitaPlan no vende datos personales.' },
      { type: 'text' as const, text: 'Podemos compartir información con proveedores tecnológicos necesarios para la operación del servicio (infraestructura, base de datos, envío de correos), bajo estándares de seguridad y confidencialidad.' },
    ],
  },
  {
    num: '7',
    title: 'Transferencias internacionales',
    content: [
      { type: 'text' as const, text: 'Los datos personales pueden ser transferidos y tratados en servidores ubicados fuera de Colombia, incluyendo Estados Unidos.' },
      { type: 'text' as const, text: 'El titular autoriza de manera expresa esta transferencia internacional, reconociendo que dichos países pueden no contar con niveles adecuados de protección de datos conforme a la legislación colombiana.' },
    ],
  },
  {
    num: '8',
    title: 'Derechos del titular',
    content: [
      { type: 'text' as const, text: 'El titular tiene derecho a:' },
      { type: 'bullet' as const, text: 'Acceder a sus datos' },
      { type: 'bullet' as const, text: 'Actualizarlos o corregirlos' },
      { type: 'bullet' as const, text: 'Solicitar su eliminación' },
      { type: 'bullet' as const, text: 'Revocar la autorización' },
      { type: 'bullet' as const, text: 'Presentar quejas ante la SIC' },
    ],
  },
  {
    num: '9',
    title: 'Eliminación de datos',
    content: [
      { type: 'text' as const, text: 'El usuario puede solicitar la eliminación de sus datos. La supresión de datos personales procederá siempre que no exista una obligación legal o contractual que requiera su conservación.' },
    ],
  },
  {
    num: '10',
    title: 'Seguridad de la información',
    content: [
      { type: 'text' as const, text: 'Implementamos medidas como:' },
      { type: 'bullet' as const, text: 'Cifrado HTTPS' },
      { type: 'bullet' as const, text: 'Control de accesos' },
      { type: 'bullet' as const, text: 'Infraestructura segura' },
    ],
  },
  {
    num: '11',
    title: 'Cookies y Tecnologías Similares',
    content: [
      { type: 'text' as const, text: 'Utilizamos cookies técnicas y de sesión estrictamente necesarias para el funcionamiento seguro de la Plataforma (por ejemplo, gestión de acceso y preferencias de visualización como el modo oscuro).' },
      { type: 'text' as const, text: 'Adicionalmente, empleamos almacenamiento local del navegador (Local Storage) para mantener el estado de la interfaz de usuario, persistir interacciones temporales y enriquecer la experiencia general.' },
      { type: 'text' as const, text: 'Si en el futuro implementamos cookies analíticas avanzadas o con fines publicitarios, desplegaremos un mecanismo para solicitar y gestionar tu consentimiento explícito antes de su uso.' },
    ],
  },
  {
    num: '12',
    title: 'Cambios en la política',
    content: [
      { type: 'text' as const, text: 'Esta política puede actualizarse. Los cambios serán informados en la plataforma.' },
    ],
  },
  {
    num: '13',
    title: 'Contacto',
    content: [
      { type: 'text' as const, text: 'Canal Habeas Data: habeasdata@habitaplan.com' },
    ],
  },
];
