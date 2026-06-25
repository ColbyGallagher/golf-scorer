'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    if ('serviceWorker' in navigator) {
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      navigator.serviceWorker
        .register(`${base}/sw.js`, { scope: `${base}/` })
        .catch(console.error);
    }
  }, []);
  return null;
}
