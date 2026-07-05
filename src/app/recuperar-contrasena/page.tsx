'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowLeft, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    // Simulate API - replace with real endpoint when available
    await new Promise((resolve) => setTimeout(resolve, 1200));
    // TODO: await apiClient.post('/auth/recuperar-contrasena', { email });
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="rcp-page">
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle variant="login" />
      </div>

      <div className="rcp-card-wrap">
        {/* Logo */}
        <div className="rcp-logo-wrap">
          <div className="rcp-logo-ring">
            <Image
              src="/logo-unt.png"
              alt="Logo Universidad Nacional de Trujillo"
              width={52}
              height={52}
              className="object-contain"
              priority
            />
          </div>
          <div className="rcp-icon-badge">
            <KeyRound className="h-4 w-4" />
          </div>
        </div>

        <div className="rcp-card">
          {!sent ? (
            <>
              <h1 className="rcp-title">Recuperar contraseña</h1>
              <p className="rcp-subtitle">
                Ingresa tu correo institucional y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              {error && (
                <div className="rcp-error" role="alert">
                  <div className="rcp-error-dot" />
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="rcp-form">
                <div>
                  <label htmlFor="recovery-email" className="rcp-label">
                    Correo electrónico institucional
                  </label>
                  <div className="rcp-input-wrap">
                    <Mail className="rcp-input-icon" />
                    <Input
                      id="recovery-email"
                      type="email"
                      placeholder="usuario@unitru.edu.pe"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      autoFocus
                      className="rcp-input"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="rcp-button"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enviando enlace...</span>
                    </>
                  ) : (
                    <span>Enviar enlace de recuperación</span>
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="rcp-success" role="status">
              <div className="rcp-success-icon">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="rcp-success-title">Enlace enviado</h2>
              <p className="rcp-success-msg">
                Si el correo <strong>{email}</strong> está registrado en el sistema, recibirás un
                enlace de recuperación en los próximos minutos. Revisa también tu carpeta de spam.
              </p>
              <Button
                onClick={() => { setSent(false); setEmail(''); }}
                className="rcp-resend-btn"
                variant="outline"
              >
                Intentar con otro correo
              </Button>
            </div>
          )}

          <div className="rcp-footer">
            <Link href="/auth/login" className="rcp-back-link">
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .rcp-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          background: #f6f8fb;
          position: relative;
          transition: background 300ms ease;
        }
        .dark .rcp-page {
          background: linear-gradient(135deg, #030712 0%, #071124 45%, #020617 100%);
        }
        .rcp-page::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.35;
          background-image: radial-gradient(rgba(15,23,42,0.055) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .dark .rcp-page::before {
          background-image: radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px);
          opacity: 0.6;
        }
        .rcp-card-wrap {
          position: relative;
          z-index: 10;
          width: min(100%, 480px);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .rcp-logo-wrap { position: relative; margin-bottom: 20px; }
        .rcp-logo-ring {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px; height: 80px;
          border-radius: 50%;
          background: rgba(255,255,255,0.97);
          border: 1px solid rgba(226,232,240,0.9);
          box-shadow: 0 8px 24px rgba(15,23,42,0.1);
          padding: 12px;
          transition: transform 300ms ease;
        }
        .rcp-logo-ring:hover { transform: scale(1.04); }
        .dark .rcp-logo-ring {
          background: rgba(18,30,55,0.96);
          border-color: rgba(73,92,128,0.55);
        }
        .rcp-icon-badge {
          position: absolute; bottom: -4px; right: -4px;
          width: 26px; height: 26px; border-radius: 50%;
          background: #c9a84c; border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          color: #06101f;
        }
        .dark .rcp-icon-badge { border-color: #030712; }
        .rcp-card {
          width: 100%;
          border-radius: 24px;
          border: 1px solid rgba(226,232,240,0.9);
          background: rgba(255, 255, 255, 0.97);
          box-shadow: 0 24px 65px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.9);
          padding: 32px 36px 28px;
          backdrop-filter: blur(18px);
          transition: background 300ms ease, border-color 300ms ease;
        }
        .dark .rcp-card {
          border-color: rgba(73,92,128,0.55);
          background: linear-gradient(180deg, rgba(18,30,55,0.97) 0%, rgba(10,19,38,0.98) 100%);
          box-shadow: 0 28px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.025) inset;
        }
        .rcp-title {
          font-size: 22px; font-weight: 850; letter-spacing: -0.03em;
          color: #0f172a; margin-bottom: 8px; line-height: 1.2;
        }
        .dark .rcp-title { color: #f8fafc; }
        .rcp-subtitle {
          font-size: 13.5px; color: #64748b; line-height: 1.5;
          font-weight: 500; margin-bottom: 24px;
        }
        .dark .rcp-subtitle { color: #94a3b8; }
        .rcp-error {
          display: flex; align-items: center; gap: 10px;
          border-radius: 12px; border: 1px solid #fee2e2;
          background: #fef2f2; padding: 11px 14px; margin-bottom: 16px;
          font-size: 13px; font-weight: 550; color: #b91c1c;
        }
        .dark .rcp-error {
          border-color: rgba(127,29,29,0.5);
          background: rgba(127,29,29,0.18); color: #fca5a5;
        }
        .rcp-error-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #ef4444; flex-shrink: 0;
        }
        .rcp-form { display: flex; flex-direction: column; gap: 16px; }
        .rcp-label {
          display: block; font-size: 12px; font-weight: 600;
          color: #475569; margin-bottom: 6px;
        }
        .dark .rcp-label { color: #b8c7dc; }
        .rcp-input-wrap { position: relative; }
        .rcp-input-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          width: 16px; height: 16px; color: #94a3b8;
          pointer-events: none; z-index: 1;
        }
        .rcp-input {
          height: 46px !important; border-radius: 13px !important;
          border: 1px solid #dbe4ef !important; background: #f8fafc !important;
          padding-left: 42px !important; font-size: 14px !important;
          font-weight: 600 !important; color: #0f172a !important;
          transition: all 220ms ease !important; width: 100% !important;
        }
        .rcp-input::placeholder { color: #94a3b8 !important; font-weight: 400 !important; }
        .rcp-input:focus {
          border-color: #378add !important;
          box-shadow: 0 0 0 4px rgba(55,138,221,0.12) !important;
        }
        .dark .rcp-input {
          border-color: rgba(73,92,128,0.8) !important;
          background: rgba(5,12,28,0.88) !important; color: #f8fafc !important;
        }
        .dark .rcp-input:focus {
          border-color: #5b8ee6 !important;
          box-shadow: 0 0 0 4px rgba(91,142,230,0.18) !important;
        }
        .rcp-button {
          position: relative !important; height: 48px !important;
          width: 100% !important; border-radius: 15px !important;
          gap: 10px !important; background: #1e293b !important;
          color: #ffffff !important; font-size: 13.5px !important;
          font-weight: 750 !important; letter-spacing: 0.02em !important;
          box-shadow: 0 10px 20px rgba(15,23,42,0.08) !important;
          transition: all 220ms ease !important;
        }
        .rcp-button:hover {
          transform: translateY(-1px) !important;
          background: #0f172a !important;
          box-shadow: 0 14px 28px rgba(15,23,42,0.14) !important;
        }
        .dark .rcp-button {
          background: linear-gradient(135deg, #c9a84c 0%, #e2c66e 100%) !important;
          color: #06101f !important;
        }
        .dark .rcp-button:hover {
          background: linear-gradient(135deg, #d6b75f 0%, #ecd486 100%) !important;
        }
        .rcp-button:disabled {
          opacity: 0.55 !important; cursor: not-allowed !important;
          transform: none !important;
        }
        .rcp-success {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 8px 0 4px;
          animation: rcpFadeIn 400ms ease;
        }
        .rcp-success-icon {
          display: flex; align-items: center; justify-content: center;
          width: 64px; height: 64px; border-radius: 50%;
          background: rgba(16,185,129,0.1); color: #10b981;
          margin-bottom: 16px; border: 1px solid rgba(16,185,129,0.2);
        }
        .dark .rcp-success-icon {
          background: rgba(16,185,129,0.12);
          border-color: rgba(16,185,129,0.25);
        }
        .rcp-success-title {
          font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 10px;
        }
        .dark .rcp-success-title { color: #f8fafc; }
        .rcp-success-msg {
          font-size: 13.5px; color: #64748b; line-height: 1.55; margin-bottom: 20px;
        }
        .dark .rcp-success-msg { color: #94a3b8; }
        .rcp-resend-btn {
          font-size: 13px !important; border-radius: 12px !important;
          border-color: rgba(203,213,225,0.9) !important;
          color: #475569 !important; height: 40px !important; padding: 0 20px !important;
        }
        .dark .rcp-resend-btn {
          border-color: rgba(73,92,128,0.7) !important;
          color: #94a3b8 !important; background: transparent !important;
        }
        .rcp-footer {
          margin-top: 24px; padding-top: 16px;
          border-top: 1px solid rgba(226,232,240,0.9);
          display: flex; justify-content: center;
        }
        .dark .rcp-footer { border-color: rgba(73,92,128,0.6); }
        .rcp-back-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 600; color: #64748b;
          text-decoration: none; transition: color 150ms ease;
        }
        .rcp-back-link:hover { color: #378add; }
        .dark .rcp-back-link { color: #8290a6; }
        .dark .rcp-back-link:hover { color: #5b8ee6; }
        @keyframes rcpFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 480px) {
          .rcp-card { padding: 24px 20px 22px; border-radius: 20px; }
        }
      `}</style>
    </div>
  );
}