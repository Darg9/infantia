// =============================================================================
// ClaimButton — Enlace para reclamar perfil de proveedor
// =============================================================================

import Link from 'next/link';

interface Props {
  providerSlug: string;
}

export default function ClaimButton({ providerSlug }: Props) {
  return (
    <Link
      href={`/proveedores/${providerSlug}/reclamar`}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-brand-400 hover:text-brand-600 transition-colors"
    >
      ✋ ¿Eres el organizador? Reclamar perfil
    </Link>
  );
}
