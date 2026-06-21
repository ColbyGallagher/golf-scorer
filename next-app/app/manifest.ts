import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return {
    name: 'Shortland Waters Golf Scorer',
    short_name: 'Golf Scorer',
    description: 'Stableford scorecard with team multiplier game',
    start_url: `${base}/`,
    display: 'standalone',
    background_color: '#0d2818',
    theme_color: '#0d2818',
    orientation: 'portrait-primary',
    icons: [
      {
        src: `${base}/icon.svg`,
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: `${base}/icon.svg`,
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
