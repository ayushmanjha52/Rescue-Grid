'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import InputField from '@/components/ui/InputField';
import Button from '@/components/ui/Button';

const RESEND_COOLDOWN = 30;

export default function VerifyOTPPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const storedPhone = localStorage.getItem('volunteer_phone');
    if (!storedPhone) {
      router.push('/volunteer/login');
      return;
    }
    setPhone(storedPhone);
  }, [router]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6 - index).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const digits = pastedData.split('');
    const newOtp = [...otp];
    digits.forEach((digit, i) => {
      newOtp[i] = digit;
    });
    setOtp(newOtp);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  const handleVerify = async () => {
    const token = otp.join('');
    if (token.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/volunteer/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, token }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Verification failed');
        setLoading(false);
        return;
      }

      localStorage.removeItem('volunteer_phone');
      router.push('/volunteer/missions');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resendLoading) return;

    setResendLoading(true);
    setError('');

    try {
      const res = await fetch('/api/volunteer/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to resend OTP');
        setResendLoading(false);
        return;
      }

      setResendTimer(RESEND_COOLDOWN);
      setResendLoading(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      setError('Network error. Please try again.');
      setResendLoading(false);
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
          <p className="font-body text-muted text-sm mt-2">Verify Your Phone</p>
        </div>

        <div className="flex flex-col gap-5 p-6 bg-surface-1" style={{ clipPath: 'var(--clip-tactical)' }}>
          <p className="font-mono text-[11px] text-dim uppercase tracking-wider text-center">
            Enter the 6-digit code sent to
            <br />
            <span className="text-ink">{phone}</span>
          </p>

          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-11 h-14 bg-surface-3 border border-border text-ink font-mono text-xl text-center tracking-widest focus:border-orange focus:outline-none transition-colors"
              />
            ))}
          </div>

          {error && (
            <p className="font-mono text-[11px] text-alert text-center">{error}</p>
          )}

          <Button
            variant="primary"
            onClick={handleVerify}
            disabled={loading || otp.join('').length !== 6}
            className="w-full mt-2"
          >
            {loading ? 'VERIFYING...' : 'VERIFY →'}
          </Button>

          <div className="flex flex-col items-center gap-2 border-t border-border-dim pt-4">
            <p className="font-mono text-[10px] text-dim uppercase tracking-wider">
              Didn&apos;t receive the code?
            </p>
            <button
              onClick={handleResend}
              disabled={resendTimer > 0 || resendLoading}
              className={`font-mono text-[11px] uppercase tracking-wider transition-colors ${
                resendTimer > 0 || resendLoading
                  ? 'text-dim cursor-not-allowed'
                  : 'text-orange hover:text-orange/80'
              }`}
            >
              {resendLoading
                ? 'SENDING...'
                : resendTimer > 0
                ? `RESEND IN ${resendTimer}s`
                : 'RESEND CODE'}
            </button>
          </div>
        </div>

        <button
          onClick={() => router.push('/volunteer/login')}
          className="w-full mt-4 font-mono text-[10px] text-dim uppercase tracking-wider hover:text-ink transition-colors"
        >
          ← Change Phone Number
        </button>
      </div>
    </main>
  );
}
