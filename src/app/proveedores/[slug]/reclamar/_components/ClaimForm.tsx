'use client';

import { useState } from 'react';

interface Props {
  providerSlug: string;
  providerName: string;
  userEmail:    string;
  userName:     string;
}

export default function ClaimForm({ providerSlug, providerName, userEmail, userName }: Props) {
  const [name, setName]       = useState(userName);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/providers/${providerSlug}/claim`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userName: name, message }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setError(data.error ?? 'Solicitud duplicada.');
        return;
      }
      if (!res.ok) {
        setError('Ocurrió un error. Intenta de nuevo.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="font-semibold text-emerald-800 text-lg">¡Solicitud enviada!</h2>
        <p className="text-sm text-emerald-700 mt-2">
          El equipo de HabitaPlan revisará tu solicitud en menos de 48 horas
          y te contactará a <strong>{userEmail}</strong>.
        </p>
        <a
          href={`/proveedores/${providerSlug}`}
          className="mt-6 inline-block text-sm text-brand-600 underline"
        >
          Volver al perfil de {providerName}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--hp-bg-surface)] border border-[var(--hp-border)] rounded-2xl p-6 space-y-5">
      {/* Nombre */}
      <div>
        <label className="block text-xs font-medium text-[var(--hp-text-primary)] mb-1">Tu nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="Nombre completo"
          required
        />
      </div>

      {/* Email — solo lectura */}
      <div>
        <label className="block text-xs font-medium text-[var(--hp-text-primary)] mb-1">Email de tu cuenta</label>
        <input
          type="email"
          value={userEmail}
          readOnly
          className="w-full border border-[var(--hp-border)] rounded-lg px-3 py-2 text-sm bg-[var(--hp-bg-page)] text-[var(--hp-text-muted)] cursor-not-allowed"
        />
      </div>

      {/* Mensaje */}
      <div>
        <label className="block text-xs font-medium text-[var(--hp-text-primary)] mb-1">
          ¿Por qué representas a {providerName}? <span className="text-[var(--hp-text-muted)]">(opcional)</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          placeholder="Ej: Soy el director de la academia, mi email corporativo es..."
        />
        <p className="text-xs text-[var(--hp-text-muted)] mt-1 text-right">{message.length}/1000</p>
      </div>

      {error && (
        <p className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition-colors"
      >
        {loading ? 'Enviando solicitud…' : 'Enviar solicitud'}
      </button>

      <p className="text-xs text-[var(--hp-text-muted)] text-center">
        Al enviar, confirmas que representas legítimamente a {providerName}.
      </p>
    </form>
  );
}
