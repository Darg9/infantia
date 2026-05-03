import React from 'react';
import Link, { LinkProps } from 'next/link';

export interface SmartLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

/**
 * SmartLink: Componente de navegación resiliente
 * 
 * Intercepta los enlaces para evitar el bug de "doble hash" en Next.js (App Router).
 * - Si el enlace es una ruta normal (ej. "/actividades"), usa el <Link> de Next.js para SPA (sin recarga).
 * - Si el enlace es un ancla (ej. "/#categorias"), usa un tag <a> nativo, forzando al navegador a manejar el hash sin interferencias de Next.js.
 */
export function SmartLink({ href, children, ...props }: SmartLinkProps) {
  // Verificamos si es un hash link (ej. "#seccion", "/#seccion")
  const isHashLink = href.startsWith('/#') || href.startsWith('#');

  if (isHashLink) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  // Next.js Link tipado
  return (
    <Link href={href} {...(props as any)}>
      {children}
    </Link>
  );
}
