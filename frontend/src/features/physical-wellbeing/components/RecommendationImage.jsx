import React, { useEffect, useState } from 'react';

export const mealImageFallbacks = {
  sri_lankan: 'https://images.unsplash.com/photo-1631515242808-497c3fbd3972?w=800&q=80',
  international: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
};

export const exerciseImageFallback = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80';

export function RecommendationImage({ src, alt, fallbackSrc, className, loading = 'lazy' }) {
  const [usingFallback, setUsingFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUsingFallback(false);
    setFailed(false);
  }, [src]);

  const primarySrc = src || fallbackSrc;
  const imageSrc = usingFallback ? fallbackSrc : primarySrc;
  if (!imageSrc || failed) return null;

  return (
    <img
      src={imageSrc}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => {
        if (!usingFallback && fallbackSrc && primarySrc !== fallbackSrc) setUsingFallback(true);
        else setFailed(true);
      }}
    />
  );
}
