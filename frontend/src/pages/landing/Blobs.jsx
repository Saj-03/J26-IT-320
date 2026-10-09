import React from 'react';

/* Organic masks, in 0–1 box units so they stretch with any element. */
export function BlobDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <clipPath id="blob-hero" clipPathUnits="objectBoundingBox">
          <path d="M0.1,0.13 C0.22,0.08 0.4,0.12 0.55,0.07 C0.66,0.03 0.72,0 0.8,0 L1,0 L1,0.95 C0.9,0.99 0.78,0.92 0.62,0.95 C0.45,0.98 0.3,1.01 0.14,0.96 C0.04,0.92 0.07,0.8 0.05,0.66 C0.03,0.52 -0.01,0.42 0.02,0.3 C0.04,0.2 0.05,0.16 0.1,0.13 Z" />
        </clipPath>
        <clipPath id="blob-l" clipPathUnits="objectBoundingBox">
          <path d="M0,0.02 C0.3,0.06 0.62,-0.02 0.84,0.04 C0.97,0.08 1.01,0.26 0.97,0.44 C0.94,0.6 1.0,0.8 0.9,0.93 C0.8,1.03 0.6,0.95 0.42,0.98 C0.25,1.0 0.1,0.97 0,0.98 Z" />
        </clipPath>
        <clipPath id="blob-r" clipPathUnits="objectBoundingBox">
          <path d="M1,0.02 C0.7,0.06 0.38,-0.02 0.16,0.04 C0.03,0.08 -0.01,0.26 0.03,0.44 C0.06,0.6 0.0,0.8 0.1,0.93 C0.2,1.03 0.4,0.95 0.58,0.98 C0.75,1.0 0.9,0.97 1,0.98 Z" />
        </clipPath>
        <clipPath id="blob-pill" clipPathUnits="objectBoundingBox">
          <path d="M0.2,0.06 C0.45,-0.02 0.8,0.02 0.94,0.16 C1.03,0.3 0.98,0.7 0.9,0.86 C0.78,1.02 0.4,1.0 0.18,0.92 C0.02,0.84 -0.02,0.5 0.03,0.3 C0.06,0.17 0.1,0.1 0.2,0.06 Z" />
        </clipPath>
        <clipPath id="blob-auth" clipPathUnits="objectBoundingBox">
          <path d="M0,0 L0.9,0 C0.97,0.1 0.93,0.22 0.97,0.34 C1.01,0.47 0.94,0.58 0.96,0.7 C0.99,0.84 0.93,0.93 0.95,1 L0,1 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}
