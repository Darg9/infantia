/**
 * Mock de next/link para Storybook.
 * Reemplaza el Link de Next.js por un <a> nativo para que funcione
 * sin el router de Next en el entorno Vite/Storybook.
 */
import React from 'react'

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  passHref?: boolean
  legacyBehavior?: boolean
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, prefetch: _prefetch, replace: _replace, scroll: _scroll, shallow: _shallow, passHref: _passHref, legacyBehavior: _legacy, children, ...rest }, ref) => (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  )
)

Link.displayName = 'MockNextLink'

export default Link
