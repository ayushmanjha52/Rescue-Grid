'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InputField from '@/components/ui/InputField';
import Button from '@/components/ui/Button';
import Turnstile from '@/components/ui/Turnstile';
import { TURNSTILE_SITE_KEY } from '@/lib/config';

export type Mode = 'join' | 'signin';

/** Volunteer join / sign-in form (phone number + PIN; no SMS). */
export default function VolunteerLoginForm({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const joining = mode === 'join';
  const phoneOk = phone.replace(/\D/g, '').length >= 10;
  const canSubmit = joining
    ? name.trim().length >= 2 && phoneOk && pin.length >= 6 && agreed && (!TURNSTILE_SITE_KEY || !!captchaToken)
    : phoneOk && pin.length > 0;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setPin('');
    setPinConfirm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joining && pin !== pinConfirm) {
      setError('The two PINs don’t match.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch(joining ? '/api/volunteer/auth/signup' : '/api/volunteer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          joining
            ? { name, phone, pin, agreed, captcha_token: captchaToken || undefined }
            : { phone, pin }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      router.replace(data.is_new ? '/volunteer/profile?welcome=1' : '/volunteer/missions');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-void flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold tracking-[0.08em] mb-1">
            <span className="text-ink">RESCUE</span>
            <span className="text-orange">GRID</span>
          </h1>
          <p className="font-body text-muted text-sm mt-2">Volunteer Portal</p>
        </div>

        <div className="grid grid-cols-2 mb-4 border border-border-dim" role="tablist">
          {(['join', 'signin'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`py-2.5 font-display text-[13px] font-semibold uppercase tracking-wider ${
                mode === m ? 'bg-orange text-white' : 'bg-surface-1 text-muted hover:text-ink'
              }`}
            >
              {m === 'join' ? 'Join as volunteer' : 'Sign in'}
            </button>
          ))}
        </div>

        {joining && (
          <p className="mb-4 font-body text-[13px] text-muted">
            Safe and able to help? Create your volunteer account in one step, then add your skills. /
            सुरक्षित हैं और मदद कर सकते हैं? अभी स्वयंसेवक बनें।
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 bg-surface-1 clip-path-tactical">
          {joining && (
            <InputField
              label="YOUR NAME"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              maxLength={80}
              autoComplete="name"
              required
            />
          )}

          <InputField
            label="MOBILE NUMBER"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            autoComplete="tel"
            required
          />

          <InputField
            label={joining ? 'CHOOSE A PIN (6+ DIGITS OR LETTERS)' : 'PIN'}
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete={joining ? 'new-password' : 'current-password'}
            maxLength={72}
            required
          />

          {joining && (
            <>
              <InputField
                label="REPEAT PIN"
                type="password"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                autoComplete="new-password"
                maxLength={72}
                required
              />

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 accent-orange"
                  required
                />
                <span className="font-body text-[12px] text-muted leading-snug">
                  I am 18 or older. I agree that the disaster-management team can see my name, phone number and skills, and
                  my location while I&apos;m available, so they can send me missions. I can go offline at any time.
                </span>
              </label>

              {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setCaptchaToken} />}
            </>
          )}

          {error && (
            <p className="font-mono text-[11px] text-alert" role="alert">{error}</p>
          )}

          <Button type="submit" variant="primary" disabled={loading || !canSubmit} className="w-full mt-1">
            {loading ? 'PLEASE WAIT…' : joining ? 'CREATE ACCOUNT →' : 'SIGN IN →'}
          </Button>

          {!joining && (
            <p className="font-body text-[12px] text-muted">
              Forgot your PIN, or registered at a relief camp? Ask the command team: they can give you a new PIN.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
