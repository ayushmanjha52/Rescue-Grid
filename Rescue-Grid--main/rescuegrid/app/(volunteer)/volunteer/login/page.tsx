'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InputField from '@/components/ui/InputField';
import Button from '@/components/ui/Button';

export default function VolunteerLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/volunteer/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to send OTP');
        setLoading(false);
        return;
      }

      localStorage.setItem('volunteer_phone', phone);
      router.push('/volunteer/login/verify');
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-void flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1
            className="font-display text-4xl font-bold tracking-[0.08em] mb-1"
            style={{ clipPath: 'var(--clip-tactical)' }}
          >
            <span className="text-ink">RESCUE</span>
            <span className="text-orange">GRID</span>
          </h1>
          <p className="font-body text-muted text-sm mt-2">Volunteer Portal</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 p-6 bg-surface-1"
          style={{ clipPath: 'var(--clip-tactical)' }}
        >
          <InputField
            label="PHONE NUMBER"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            required
            autoComplete="tel"
          />

          <p className="font-mono text-[10px] text-dim uppercase tracking-wider">
            ENTER YOUR REGISTERED PHONE
          </p>

          {error && (
            <p className="font-mono text-[11px] text-alert">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={loading || !phone}
            className="w-full mt-2"
          >
            {loading ? 'SENDING OTP...' : 'LOGIN →'}
          </Button>
        </form>
      </div>
    </main>
  );
}
