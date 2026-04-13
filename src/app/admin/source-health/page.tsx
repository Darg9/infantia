import { Metadata } from 'next';
import SourceHealthClient from './client';

export const metadata: Metadata = {
  title: 'Source Health Monitoring | Admin',
  description: 'Monitor de estado de fuentes de ingesta.',
};

export default function SourceHealthPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Ingestion Resilience</h1>
        <p className="text-gray-600">
          Monitorización autónoma de orígenes. Sistema inteligente con auto-bloqueos en endpoints inestables.
        </p>
      </div>
      <SourceHealthClient />
    </div>
  );
}
