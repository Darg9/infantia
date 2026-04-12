// =============================================================================
// Tratamiento de Datos — Fuente de Verdad Única (Single Source of Truth)
// =============================================================================

export const DATA_TREATMENT_META = {
  title: "Política de Tratamiento de Datos Personales",
  lastUpdated: "11 de abril de 2026",
  version: "v1.0",
  filename: "tratamiento-datos-habitaplan.pdf",
  brand: "HabitaPlan",
  applicableLaw: "Ley 1581 de 2012 · Decreto 1377 de 2013 · Decreto 886 de 2014"
};

export const DATA_TREATMENT_SUMMARY = [
  "Responsable identificado: HabitaPlan define el tratamiento de datos conforme a la Ley 1581.",
  "Finalidad clara: Usamos datos únicamente para operar la plataforma y mejorar el servicio.",
  "Derechos del usuario: Puedes acceder, corregir, eliminar o revocar autorización.",
  "Protección de menores: Requiere autorización previa de padres o tutores."
];

export const DATA_TREATMENT_SECTIONS = [
  {
    num: "1",
    title: "Identificación del responsable",
    content: [{ type: "text" as const, text: "HabitaPlan, con domicilio en Bogotá D.C., Colombia, es responsable del tratamiento de los datos personales." }]
  },
  {
    num: "2",
    title: "Marco normativo",
    content: [{ type: "text" as const, text: "Esta política se rige por la Constitución Política de Colombia (art. 15), la Ley 1581 de 2012, el Decreto 1377 de 2013 y el Decreto 886 de 2014." }]
  },
  {
    num: "3",
    title: "Definiciones",
    content: [{ type: "text" as const, text: "Dato personal: información vinculada a persona natural. Titular: persona cuyos datos son tratados. Tratamiento: recolección, almacenamiento, uso o supresión." }]
  },
  {
    num: "4",
    title: "Datos tratados",
    content: [{ type: "text" as const, text: "Correo electrónico, nombre (opcional), datos de uso, dirección IP y datos asociados a menores con autorización parental." }]
  },
  {
    num: "5",
    title: "Finalidades",
    content: [{ type: "text" as const, text: "Gestión de cuentas, prestación del servicio, seguridad, atención de solicitudes, cumplimiento legal y generación de estadísticas agregadas." }]
  },
  {
    num: "6",
    title: "Autorización",
    content: [{ type: "text" as const, text: "El tratamiento requiere autorización previa, expresa e informada del titular." }]
  },
  {
    num: "7",
    title: "Tratamiento de menores",
    content: [{ type: "text" as const, text: "Los datos de menores serán tratados únicamente con autorización del padre o tutor, conforme a la ley. El registro de menores de edad requiere un proceso de autorización parental verificable, el cual incluye el envío de una solicitud al padre o tutor, la aceptación expresa mediante un enlace seguro y el registro del consentimiento con fines de auditoría." }]
  },
  {
    num: "8",
    title: "Derechos del titular",
    content: [{ type: "text" as const, text: "Acceder, actualizar, rectificar, solicitar supresión, revocar autorización y presentar quejas ante la SIC." }]
  },
  {
    num: "9",
    title: "Procedimiento",
    content: [{ type: "text" as const, text: "Las consultas serán atendidas en 10 días hábiles y reclamos en 15 días hábiles." }]
  },
  {
    num: "10",
    title: "Seguridad",
    content: [{ type: "text" as const, text: "Implementamos medidas técnicas como cifrado, control de acceso y almacenamiento seguro." }]
  },
  {
    num: "11",
    title: "Transferencias",
    content: [
      { type: "text" as const, text: "Los datos personales pueden ser transferidos y tratados en servidores ubicados fuera de Colombia, incluyendo Estados Unidos." },
      { type: "text" as const, text: "El titular autoriza de manera expresa esta transferencia internacional, reconociendo que dichos países pueden no contar con niveles adecuados de protección de datos conforme a la legislación colombiana." }
    ]
  },
  {
    num: "12",
    title: "Vigencia",
    content: [{ type: "text" as const, text: "Los datos serán tratados mientras sea necesario para las finalidades o hasta solicitud de supresión. La supresión de datos personales procederá siempre que no exista una obligación legal o contractual que requiera su conservación." }]
  },
  {
    num: "13",
    title: "Contacto",
    content: [{ type: "text" as const, text: "habeasdata@habitaplan.com" }]
  }
];
