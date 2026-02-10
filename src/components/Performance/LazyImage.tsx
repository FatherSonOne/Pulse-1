import { useState, useEffect, useRef, CSSProperties } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  threshold?: number;
  rootMargin?: string;
}

/**
 * LazyImage Component
 * Optimized image loading with Intersection Observer
 *
 * Features:
 * - Lazy loading (only loads when visible)
 * - Blur-up placeholder
 * - Progressive enhancement
 * - Automatic retry on error
 * - Fade-in animation
 */
export function LazyImage({
  src,
  alt,
  className = '',
  style,
  placeholder,
  blurDataURL,
  onLoad,
  onError,
  threshold = 0.01,
  rootMargin = '50px'
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const maxRetries = 3;

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Create Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(img);
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    observer.observe(img);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    if (retryCount < maxRetries) {
      // Retry with exponential backoff
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setHasError(false);
      }, Math.pow(2, retryCount) * 1000);
    } else {
      setHasError(true);
      onError?.();
    }
  };

  // Determine which image to show
  const imageSrc = isInView ? src : blurDataURL || placeholder;

  return (
    <div
      className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${className}`}
      style={style}
    >
      {/* Blur placeholder */}
      {blurDataURL && !isLoaded && (
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-lg scale-110"
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`
          w-full h-full object-cover transition-opacity duration-300
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
        `}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
      />

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
          <i className="fa-solid fa-image-slash text-2xl mb-2"></i>
          <span className="text-xs">Failed to load image</span>
        </div>
      )}

      {/* Loading spinner */}
      {!isLoaded && !hasError && isInView && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-zinc-300 dark:border-zinc-600 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook for progressive image loading
 */
export function useProgressiveImage(src: string): {
  imgSrc: string;
  isLoading: boolean;
  hasError: boolean;
} {
  const [imgSrc, setImgSrc] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    const img = new Image();

    img.onload = () => {
      setImgSrc(src);
      setIsLoading(false);
    };

    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { imgSrc, isLoading, hasError };
}
