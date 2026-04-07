// =============================================================================
// /proveedores/[slug]/reclamar — Formulario para reclamar perfil de proveedor
// =============================================================================

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAuth, getOrCreateDbUser } from '@/lib/auth';
import ClaimForm from './_components/ClaimForm';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const provider = await prisma.provider.findUnique({ where: { slug }, select: { name: true } });
  if (!provider) return {};
  return { title: `Reclamar perfil — ${provider.name} | HabitaPlan` };
}

export default async function ReclamarPage({ params }: PageProps) {
  const { slug } = await params;
  const authUser = await requireAuth(); // redirige a /login si no está autenticado

  const provider = await prisma.provider.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, isClaimed: true },
  });

  if (!provider) notFound();
  if (provider.isClaimed) redirect(`/proveedores/${slug}`);

  const dbUser = await getOrCreateDbUser(authUser);

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="mb-8">
        <a href={`/proveedores/${slug}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← {provider.name}
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Reclamar perfil</h1>
        <p className="text-sm text-gray-500 mt-1">
          ¿Representas a <strong>{provider.name}</strong>? Envíanos tu solicitud y la revisaremos en menos de 48 horas.
        </p>
      </div>

      <ClaimForm
        providerSlug={slug}
        providerName={provider.name}
        userEmail={authUser.email ?? ''}
        userName={dbUser.name ?? ''}
      />
    </main>
  );
}
