'use client';
import { Button, Input } from '@/components/ui';

// =============================================================================
// /onboarding — Wizard de configuración inicial
// Paso 1: Ciudad  →  Paso 2: Hijos  →  Paso 3: Listo
// =============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface City { id: string; name: string; countryName: string }

const CONSENT_TEXT =
  'Soy el padre, madre o tutor legal de este menor y autorizo el tratamiento de sus datos personales ' +
  'por parte de HabitaPlan conforme a la Política de Tratamiento de Datos Personales (Ley 1581 de 2012). ' +
  'Los datos del menor se usarán exclusivamente para personalizar la búsqueda de actividades y nunca serán ' +
  'compartidos con terceros para fines comerciales.';

// ── Indicador de pasos ────────────────────────────────────────────────────────
function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={`h-2 rounded-full transition-all ${
            s === step ? 'w-8 bg-brand-500' : s < step ? 'w-2 bg-brand-300' : 'w-2 bg-[var(--hp-bg-surface)]'
          }`}
        />
      ))}
    </div>
  );
}

// ── Paso 1: Ciudad ────────────────────────────────────────────────────────────
function StepCiudad({ onNext }: { onNext: (cityId?: string) => void }) {
  const [cities, setCities]   = useState<City[]>([]);
  const [cityId, setCityId]   = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/cities').then((r) => r.json()).then(setCities);
  }, []);

  async function handleNext() {
    setLoading(true);
    await fetch('/api/profile/onboarding', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cityId: cityId || undefined }),
    });
    onNext(cityId || undefined);
  }

  return (
    <div>
      <div className="text-4xl mb-4">📍</div>
      <h2 className="text-xl font-bold text-[var(--hp-text-primary)] mb-1">¿En qué ciudad vives?</h2>
      <p className="text-sm text-[var(--hp-text-secondary)] mb-6">
        Te mostraremos actividades cerca a ti.
      </p>
      <div className="space-y-2 mb-8 max-h-64 overflow-y-auto pr-1">
        {cities.map((c) => (
          <Button
            key={c.id}
            onClick={() => setCityId(c.id)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
              cityId === c.id
                ? 'border-brand-400 bg-brand-50 text-brand-700'
                : 'border-[var(--hp-border)] text-[var(--hp-text-primary)] hover:border-[var(--hp-border-subtle)]'
            }`}
          >
            {c.name}
          </Button>
        ))}
      </div>
      <Button
        onClick={handleNext}
        disabled={loading}
        className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors"
      >
        {cityId ? 'Continuar →' : 'Saltar por ahora →'}
      </Button>
    </div>
  );
}

// ── Paso 2: Hijos ─────────────────────────────────────────────────────────────
function StepHijos({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [name, setName]               = useState('');
  const [birthDate, setBirthDate]     = useState('');
  const [consentAccepted, setConsent] = useState(false);
  const [saved, setSaved]             = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const today   = new Date();
  const maxDate = today.toISOString().split('T')[0];
  const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    .toISOString().split('T')[0];

  async function handleSave() {
    if (!consentAccepted) { setError('Debes aceptar la autorización para continuar.'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/children', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, birthDate, consentAccepted }),
    });
    if (res.ok) { setSaved(true); }
    else { const d = await res.json(); setError(d.error ?? 'Error al guardar.'); }
    setSaving(false);
  }

  if (saved) {
    return (
      <div>
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-[var(--hp-text-primary)] mb-1">¡Perfil guardado!</h2>
        <p className="text-sm text-[var(--hp-text-secondary)] mb-8">
          Usaremos la edad de <strong>{name}</strong> para recomendarte actividades ideales.
        </p>
        <Button
          onClick={onNext}
          className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 text-sm transition-colors"
        >
          Continuar →
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-4xl mb-4">👨‍👩‍👧</div>
      <h2 className="text-xl font-bold text-[var(--hp-text-primary)] mb-1">¿Tienes hijos?</h2>
      <p className="text-sm text-[var(--hp-text-secondary)] mb-6">
        Agrega su perfil para ver actividades según su edad. Puedes agregar más después.
      </p>
      <div className="space-y-4 mb-5">
        <div>
          <label className="block text-xs font-medium text-[var(--hp-text-primary)] mb-1">Nombre del niño o niña</label>
          { }
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className='w-full border border-[var(--hp-border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
            placeholder="Nombre"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--hp-text-primary)] mb-1">Fecha de nacimiento</label>
          { }
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            min={minDate}
            max={maxDate}
            className='w-full border border-[var(--hp-border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
          />
        </div>
        <div className="flex items-start gap-2">
          <Input
            type="checkbox"
            id="consent"
            checked={consentAccepted}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <label htmlFor="consent" className="text-xs text-[var(--hp-text-secondary)] leading-relaxed cursor-pointer">
            {CONSENT_TEXT}
          </label>
        </div>
      </div>
      {error && (
        <p className="text-xs text-error-600 mb-4 bg-error-50 border border-error-200 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || !birthDate || !consentAccepted}
          className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar y continuar →'}
        </Button>
        <Button
          onClick={onSkip}
          className='w-full text-sm text-[var(--hp-text-muted)] hover:text-[var(--hp-text-secondary)] py-2 transition-colors'
        >
          Saltar — lo agrego después
        </Button>
      </div>
    </div>
  );
}

// ── Paso 3: Listo ─────────────────────────────────────────────────────────────
function StepListo({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="text-center">
      <div className="text-5xl mb-5">🎊</div>
      <h2 className="text-2xl font-bold text-[var(--hp-text-primary)] mb-2">¡Todo listo!</h2>
      <p className="text-sm text-[var(--hp-text-secondary)] mb-8 leading-relaxed">
        Ya puedes explorar actividades personalizadas para tu familia.<br />
        Puedes completar tu perfil en cualquier momento.
      </p>
      <Button
        onClick={onFinish}
        className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 text-sm transition-colors"
      >
        Ver actividades →
      </Button>
    </div>
  );
}

// ── Wizard principal ──────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router  = useRouter();
  const [step, setStep] = useState(1);

  function finish() {
    router.push('/actividades');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo / marca */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-brand-500">habitaplan</span>
          <p className="text-xs text-[var(--hp-text-muted)] mt-1">Configura tu cuenta en 2 minutos</p>
        </div>

        <div className='bg-[var(--hp-bg-surface)] rounded-2xl border border-[var(--hp-border)] p-7 shadow-[var(--hp-shadow-[var(--hp-shadow-md)])]'>
          <StepDots step={step} />

          {step === 1 && (
            <StepCiudad onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <StepHijos onNext={() => setStep(3)} onSkip={() => setStep(3)} />
          )}
          {step === 3 && (
            <StepListo onFinish={finish} />
          )}
        </div>
      </div>
    </div>
  );
}
