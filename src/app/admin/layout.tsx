'use client'

import { useEffect, useState } from 'react';
import { SystemStatus } from '@/modules/scraping/alerts';

function GlobalAlert() {
  const [status, setStatus] = useState<SystemStatus | 'loading'>('loading');

  useEffect(() => {
    fetch('/api/admin/alerts')
      .then(res => res.json())
      .then(data => {
        if (data && data.status) {
          setStatus(data.status);
        }
      })
      .catch((e) => {
         console.error('Error fetching global alert', e);
         setStatus('healthy');
      });
  }, []);

  if (status === 'over') {
    return (
      <div className="sticky top-0 z-50 w-full bg-error-600 text-white text-center py-2 px-4 shadow text-sm font-semibold tracking-wider uppercase">
        🚨 Sistema de ingesta en estado crítico (Over-Filtering)
      </div>
    );
  }

  return null;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <GlobalAlert />
      {children}
    </div>
  );
}
