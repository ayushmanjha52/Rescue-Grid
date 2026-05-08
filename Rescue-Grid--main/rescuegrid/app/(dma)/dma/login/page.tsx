'use client';

export const dynamic = "force-dynamic";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import InputField from '@/components/ui/InputField';
import Button from '@/components/ui/Button';

export default function DmaLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push('/dma/dashboard');
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold tracking-[0.08em] mb-1">
            <span className="text-gray-900">RESCUE</span>
            <span className="text-orange">GRID</span>
          </h1>
          <p className="font-body text-base text-gray-500 mt-2">DMA Command Center</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 p-8 bg-white border border-gray-200 rounded-sm shadow-sm"
        >
          <InputField
            label="EMAIL"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dma@rescuegrid.in"
            required
            autoComplete="email"
          />

          <div className="relative">
            <InputField
              label="PASSWORD"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-gray-400 hover:text-orange transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

          {error && (
            <p className="font-mono text-xs text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={loading || !email || !password}
            className="w-full mt-2"
          >
            {loading ? 'AUTHENTICATING...' : 'LOGIN →'}
          </Button>
        </form>
      </div>
    </main>
  );
}
