/**
 * Mock de next/image para Storybook.
 * Reemplaza el componente Image de Next.js por un <img> nativo para que funcione
 * sin el servidor de imágenes de Next en el entorno Vite/Storybook.
 */
import React from 'react'

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  width?: number | string
  height?: number | string
  fill?: boolean
  priority?: boolean
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  unoptimized?: boolean
  loader?: unknown
  sizes?: string
  onLoadingComplete?: unknown
}

const Image = React.forwardRef<HTMLImageElement, ImageProps>(
  (
    {
      src,
      alt,
      width,
      height,
      fill,
      priority: _priority,
      quality: _quality,
      placeholder: _placeholder,
      blurDataURL: _blurDataURL,
      unoptimized: _unoptimized,
      loader: _loader,
      onLoadingComplete: _onLoadingComplete,
      style,
      ...rest
    },
    ref
  ) => {
    const computedStyle: React.CSSProperties = fill
      ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }
      : style ?? {}

    return (
      // eslint-disable-next-line @next/next/no-img-element -- mock de next/image para Storybook sin servidor Next
      <img
        ref={ref}
        src={typeof src === 'string' ? src : ''}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        style={computedStyle}
        {...rest}
      />
    )
  }
)

Image.displayName = 'MockNextImage'

export default Image
