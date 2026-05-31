'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye, EyeOff, LogIn, Loader2,
  CalendarDays, Shield, GraduationCap, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClientError } from '@/lib/api-client';
import { DEMO_USERS } from '@/lib/demo-users';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import type { DemoUser } from '@/lib/demo-users';

const ROLE_COLORS: Record<string, { dot: string; initials: string }> = {
  super: { dot: '#a78bfa', initials: 'SA' },
  admin: { dot: '#3b82f6', initials: 'AD' },
  operador: { dot: '#f59e0b', initials: 'OP' },
  docente: { dot: '#10b981', initials: 'DC' },
  monitor: { dot: '#ec4899', initials: 'MO' },
};

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const [highlightInputs, setHighlightInputs] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      if (user.rol === 'DOCENTE') router.replace('/dashboard/docente');
      else router.replace('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (toast.visible) {
      const t = setTimeout(() => setToast({ visible: false, message: '' }), 2500);
      return () => clearTimeout(t);
    }
  }, [toast.visible]);

  useEffect(() => {
    if (highlightInputs) {
      const t = setTimeout(() => setHighlightInputs(false), 800);
      return () => clearTimeout(t);
    }
  }, [highlightInputs]);

  const fillDemo = (u: DemoUser) => {
    setEmail(u.email);
    setPassword(u.password);
    setSelectedDemo(u.id);
    setError('');
    setHighlightInputs(true);
    setToast({ visible: true, message: `Credenciales de ${u.label} cargadas` });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Error de conexión. Verifique que el servidor esté funcionando.'
      );
    } finally {
      setLoading(false);
    }
  };

  const detectCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState && e.getModifierState('CapsLock'));
  };

  return (
    <div className="login-page flex min-h-screen w-full select-none lg:h-screen lg:overflow-hidden">
      {/* TOAST */}
      <div
        className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 transition-all duration-300 ${toast.visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none -translate-y-4 opacity-0'
          }`}
      >
        <div className="login-toast">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
            <CheckCircle2 className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
          <span className="text-[13px] font-medium">
            {toast.message}
          </span>
        </div>
      </div>

      {/* PANEL IZQUIERDO */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:h-full lg:flex-col lg:justify-between"
        style={{ width: '45%', background: '#020617' }}
      >
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            maskImage: 'radial-gradient(ellipse at center, black, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black, transparent 75%)',
          }}
        />

        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[650px] w-[650px] rounded-full opacity-40 blur-[130px]"
          style={{
            background:
              'radial-gradient(circle, rgba(55,138,221,0.5) 0%, rgba(15,45,85,0) 70%)',
          }}
        />

        <div
          className="pointer-events-none absolute -bottom-20 -left-20 h-[500px] w-[500px] rounded-full opacity-30 blur-[110px]"
          style={{
            background:
              'radial-gradient(circle, rgba(201,168,76,0.3) 0%, rgba(15,45,85,0) 70%)',
          }}
        />

        <div className="relative z-10 flex flex-col gap-4 p-8 pt-8 xl:p-10 xl:pt-8">
          <div className="flex items-center gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg shadow-[#c9a84c]/5"
              style={{
                background:
                  'linear-gradient(135deg, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.05) 100%)',
                border: '1px solid rgba(201,168,76,0.3)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="1" y="1" width="9" height="9" rx="2" fill="#c9a84c" />
                <rect x="12" y="1" width="9" height="9" rx="2" fill="rgba(255,255,255,0.4)" />
                <rect x="1" y="12" width="9" height="9" rx="2" fill="rgba(255,255,255,0.2)" />
                <rect x="12" y="12" width="9" height="9" rx="2" fill="#378add" />
              </svg>
            </div>

            <div>
              <p
                style={{
                  fontSize: 10,
                  letterSpacing: '3px',
                  color: '#c9a84c',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                UNT · Ingeniería de Sistemas
              </p>
              <p
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.72)',
                  letterSpacing: '0.5px',
                  marginTop: '1px',
                }}
              >
                Sistema de Gestión de Horarios Académicos
              </p>
            </div>
          </div>

          <div
            className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1"
            style={{
              background: 'rgba(201,168,76,0.08)',
              border: '1px solid rgba(201,168,76,0.2)',
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: '#c9a84c' }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: '#c9a84c' }}
              />
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#c9a84c',
                letterSpacing: 0.8,
              }}
            >
              Período Académico 2026-I · Activo
            </span>
          </div>

          <div style={{ lineHeight: 1.15 }}>
            <h2
              style={{
                fontSize: 'clamp(1.75rem, 2.55vw, 3rem)',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: -1.5,
                margin: 0,
              }}
            >
              Gestión
            </h2>

            <h2
              style={{
                fontSize: 'clamp(1.75rem, 2.55vw, 3rem)',
                fontWeight: 800,
                letterSpacing: -1.5,
                margin: 0,
              }}
              className="bg-gradient-to-r from-[#c9a84c] to-[#e4c975] bg-clip-text text-transparent"
            >
              inteligente
            </h2>

            <h2
              style={{
                fontSize: 'clamp(1.75rem, 2.55vw, 3rem)',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.94)',
                letterSpacing: -1.5,
                margin: 0,
              }}
            >
              de horarios académicos.
            </h2>
          </div>

          <p
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.58)',
              maxWidth: 430,
            }}
          >
            Plataforma institucional unificada para la programación y optimización
            de clases, distribución de aulas, laboratorios y atención docente en
            Ingeniería de Sistemas.
          </p>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} className="mt-1">
            {[
              {
                n: '01',
                icon: CalendarDays,
                text: 'Calendario semanal interactivo y libre de conflictos',
              },
              {
                n: '02',
                icon: Shield,
                text: 'Accesos seguros para Directores, Docentes y Alumnos',
              },
              {
                n: '03',
                icon: GraduationCap,
                text: 'Reportes oficiales, notificaciones y control de colas',
              },
            ].map(({ n, icon: Icon, text }) => (
              <div
                key={n}
                className="group flex cursor-default items-center gap-4 transition-all duration-300 hover:pl-2"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  padding: '9px 0',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: 'rgba(201,168,76,0.42)',
                    minWidth: 18,
                  }}
                  className="transition-colors group-hover:text-[#c9a84c]"
                >
                  {n}
                </span>

                <div
                  style={{
                    width: 1,
                    height: 14,
                    background: 'rgba(255,255,255,0.09)',
                    flexShrink: 0,
                  }}
                />

                <Icon
                  style={{ width: 14, height: 14, flexShrink: 0 }}
                  className="text-white/25 transition-colors duration-300 group-hover:text-white/80"
                />

                <span
                  style={{ fontSize: 12.5, lineHeight: 1.4 }}
                  className="text-white/50 transition-colors duration-300 group-hover:text-white/85"
                >
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 px-8 pb-6 xl:px-10">
          <div
            className="mb-4 grid grid-cols-4 rounded-2xl p-4 backdrop-blur-md"
            style={{
              background: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.02)',
            }}
          >
            {[
              { n: '30', l: 'Docentes' },
              { n: '82', l: 'Cursos' },
              { n: '12', l: 'Ambientes' },
              { n: '246', l: 'Grupos' },
            ].map((s, i) => (
              <div
                key={s.l}
                className="group text-center"
                style={{
                  borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    letterSpacing: -0.5,
                  }}
                  className="inline-block bg-gradient-to-b from-[#e4c975] to-[#c9a84c] bg-clip-text text-transparent transition-transform duration-300 group-hover:scale-110"
                >
                  {s.n}
                </div>

                <div
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.36)',
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    marginTop: 3,
                    fontWeight: 650,
                  }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3 flex items-center gap-4">
            {['Soporte', 'Documentación', 'Privacidad'].map((link) => (
              <button
                key={link}
                className="text-[11px] tracking-wide transition-colors hover:text-[#c9a84c]"
                style={{ color: 'rgba(255,255,255,0.38)' }}
              >
                {link}
              </button>
            ))}
          </div>

          <p
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.22)',
              letterSpacing: 0.8,
            }}
          >
            © {new Date().getFullYear()} UNT · Escuela de Ingeniería de Sistemas
          </p>
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="login-right relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-8 transition-colors duration-300 lg:h-full lg:px-8 lg:py-0">
        <div className="login-right-bg" />
        <div className="login-right-grid" />
        <div className="login-right-glow-one" />
        <div className="login-right-glow-two" />

        <div className="absolute right-6 top-6 z-20">
          <ThemeToggle variant="login" />
        </div>

        {/* LOGO MOBILE */}
        <div className="relative z-10 mb-6 text-center lg:hidden">
          <div
            className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/50 shadow-md dark:border-slate-700"
            style={{
              background: 'linear-gradient(135deg, #091326 0%, #030712 100%)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
              <rect x="1" y="1" width="9" height="9" rx="2" fill="#c9a84c" />
              <rect x="12" y="1" width="9" height="9" rx="2" fill="rgba(255,255,255,0.45)" />
              <rect x="1" y="12" width="9" height="9" rx="2" fill="rgba(255,255,255,0.2)" />
              <rect x="12" y="12" width="9" height="9" rx="2" fill="#378add" />
            </svg>
          </div>

          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            UNT · Ingeniería de Sistemas
          </h2>

          <p className="mt-1 text-xs font-semibold uppercase tracking-[1.5px] text-[#c9a84c]">
            Gestión de Horarios Académicos
          </p>
        </div>

        {/* CARD */}
        <div
          className={`
            login-card-wrap relative z-10 w-full transition-all duration-500
            ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
          `}
        >
          <div className="login-card">
            <div className="login-card-inner">
              {/* HEADER */}
              <div className="mb-5">
                <h2 className="login-title">
                  Acceso al Sistema
                </h2>

                <p className="login-subtitle">
                  Ingrese sus credenciales de Ingeniería de Sistemas para continuar
                </p>
              </div>

              {/* ROLES */}
              <div className="mb-4">
                <div className="login-section-title">
                  <div />
                  <span>Acceso rápido por rol</span>
                  <div />
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                  {DEMO_USERS.map((u, idx) => {
                    const c = ROLE_COLORS[u.id] ?? ROLE_COLORS.admin;
                    const sel = selectedDemo === u.id;

                    const colSpan =
                      idx < 3
                        ? 'col-span-1 lg:col-span-2'
                        : idx === 3
                          ? 'col-span-1 lg:col-span-3'
                          : 'col-span-2 lg:col-span-3';

                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => fillDemo(u)}
                        style={{ animationDelay: `${idx * 30}ms` }}
                        className={`role-card ${sel ? 'role-card-selected' : ''} ${colSpan}`}
                      >
                        <div
                          className="role-badge"
                          style={{
                            background: sel ? '#c9a84c' : `${c.dot}24`,
                            color: sel ? '#071123' : c.dot,
                            border: sel ? '1px solid #e4c975' : `1px solid ${c.dot}42`,
                          }}
                        >
                          {c.initials}
                        </div>

                        <div className="flex min-w-0 flex-col">
                          <span className="role-name">
                            {u.label}
                          </span>

                          <span className="role-description">
                            {u.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="demo-alert">
                  <Shield className="h-5 w-5 shrink-0 text-[#c9a84c]" />
                  <span>
                    Entorno institucional de demostración. Las credenciales se autocompletan
                    de manera segura al seleccionar un rol.
                  </span>
                </div>
              </div>

              <div className="login-section-title mb-4">
                <div />
                <span>O ingrese manualmente</span>
                <div />
              </div>

              {error && (
                <div className="error-box">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  </div>

                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="email" className="login-label">
                    Correo electrónico
                  </label>

                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@unitru.edu.pe"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setSelectedDemo(null);
                    }}
                    required
                    autoComplete="email"
                    className={`login-input ${highlightInputs ? 'login-input-highlight' : ''
                      }`}
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="login-label mb-0">
                      Contraseña
                    </label>

                    {capsLock && (
                      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                        Bloq Mayús activado
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setSelectedDemo(null);
                      }}
                      onKeyUp={detectCapsLock}
                      onKeyDown={detectCapsLock}
                      required
                      autoComplete="current-password"
                      className={`login-input pr-12 ${highlightInputs ? 'login-input-highlight' : ''
                        }`}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                      className="password-toggle"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="login-button"
                >
                  <span className="login-button-shine" />

                  {loading ? (
                    <>
                      <Loader2 className="relative z-10 h-5 w-5 animate-spin" />
                      <span className="relative z-10 normal-case tracking-normal">
                        Validando acceso...
                      </span>
                    </>
                  ) : (
                    <>
                      <LogIn className="relative z-10 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                      <span className="relative z-10">Ingresar al sistema</span>
                    </>
                  )}
                </Button>
              </form>

              <p className="login-footer">
                © {new Date().getFullYear()} Universidad Nacional de Trujillo · Departamento de Sistemas
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .login-page {
          --card-radius: 24px;
        }

        .login-toast {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 999px;
          padding: 10px 16px;
          border: 1px solid #bbf7d0;
          background: rgba(255, 255, 255, 0.96);
          color: #334155;
          box-shadow: 0 18px 40px rgba(16, 185, 129, 0.14);
          backdrop-filter: blur(16px);
        }

        .dark .login-toast {
          border-color: rgba(16, 185, 129, 0.35);
          background: rgba(15, 23, 42, 0.96);
          color: #e2e8f0;
        }

        .login-right {
          background: #f6f8fb;
        }

        .login-right-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 100% 0%, rgba(55, 138, 221, 0.08) 0%, transparent 42%),
            radial-gradient(circle at 0% 100%, rgba(201, 168, 76, 0.06) 0%, transparent 45%);
        }

        .login-right-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.38;
          background-image: radial-gradient(rgba(15, 23, 42, 0.055) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        .login-right-glow-one,
        .login-right-glow-two {
          position: absolute;
          pointer-events: none;
          display: none;
        }

        .dark .login-right {
          background:
            radial-gradient(circle at 88% 8%, rgba(55, 138, 221, 0.12) 0%, transparent 34%),
            radial-gradient(circle at 18% 82%, rgba(201, 168, 76, 0.08) 0%, transparent 36%),
            linear-gradient(135deg, #030712 0%, #071124 45%, #020617 100%);
        }

        .dark .login-right-bg {
          background:
            linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
          background-size: 42px 42px;
          opacity: 0.55;
          mask-image: radial-gradient(ellipse at center, black, transparent 78%);
          -webkit-mask-image: radial-gradient(ellipse at center, black, transparent 78%);
        }

        .dark .login-right-grid {
          opacity: 0;
        }

        .dark .login-right-glow-one {
          display: block;
          right: -140px;
          top: -130px;
          height: 440px;
          width: 440px;
          border-radius: 999px;
          opacity: 0.38;
          filter: blur(115px);
          background: radial-gradient(circle, rgba(55, 138, 221, 0.45), transparent 68%);
        }

        .dark .login-right-glow-two {
          display: block;
          left: 8%;
          bottom: -165px;
          height: 400px;
          width: 400px;
          border-radius: 999px;
          opacity: 0.28;
          filter: blur(105px);
          background: radial-gradient(circle, rgba(201, 168, 76, 0.34), transparent 70%);
        }

        .login-card-wrap {
          width: min(100%, 660px);
          max-width: 660px;
          transform-origin: center;
        }

        .login-card {
          overflow: hidden;
          border-radius: var(--card-radius);
          border: 1px solid rgba(226, 232, 240, 0.9);
          background: rgba(255, 255, 255, 0.96);
          box-shadow:
            0 24px 65px rgba(15, 23, 42, 0.11),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(18px);
        }

        .dark .login-card {
          border: 1px solid rgba(73, 92, 128, 0.55);
          background:
            linear-gradient(180deg, rgba(18, 30, 55, 0.96) 0%, rgba(10, 19, 38, 0.98) 100%);
          box-shadow:
            0 28px 80px rgba(0, 0, 0, 0.64),
            0 0 0 1px rgba(255, 255, 255, 0.025) inset,
            0 1px 0 rgba(255, 255, 255, 0.05) inset;
        }

        .login-card-inner {
          padding: 28px 36px;
        }

        .login-title {
          font-size: 26px;
          line-height: 1.1;
          letter-spacing: -0.035em;
          font-weight: 850;
          color: #0f172a;
        }

        .dark .login-title {
          color: #f8fafc;
        }

        .login-subtitle {
          margin-top: 7px;
          font-size: 13.5px;
          line-height: 1.45;
          font-weight: 500;
          color: #64748b;
        }

        .dark .login-subtitle {
          color: #aab8cc;
        }

        .login-section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }

        .login-section-title div {
          height: 1px;
          flex: 1;
          background: rgba(203, 213, 225, 0.9);
        }

        .login-section-title span {
          font-size: 10.5px;
          font-weight: 850;
          letter-spacing: 2.45px;
          text-transform: uppercase;
          color: #64748b;
          white-space: nowrap;
        }

        .dark .login-section-title div {
          background: rgba(73, 92, 128, 0.72);
        }

        .dark .login-section-title span {
          color: #8fa2bd;
        }

        .role-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(203, 213, 225, 0.85);
          background: rgba(248, 250, 252, 0.92);
          text-align: left;
          transition: all 220ms ease;
          animation: slideUp 0.4s ease-out backwards;
        }

        .role-card:hover {
          transform: translateY(-1px);
          border-color: rgba(148, 163, 184, 0.85);
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
        }

        .dark .role-card {
          border-color: rgba(73, 92, 128, 0.72);
          background: rgba(16, 28, 52, 0.78);
        }

        .dark .role-card:hover {
          border-color: rgba(96, 124, 166, 0.9);
          background: rgba(20, 36, 66, 0.92);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
        }

        .role-card-selected {
          border-color: rgba(201, 168, 76, 0.95);
          background: rgba(201, 168, 76, 0.12);
          box-shadow: 0 10px 24px rgba(201, 168, 76, 0.16);
        }

        .dark .role-card-selected {
          border-color: rgba(228, 201, 117, 0.85);
          background: rgba(201, 168, 76, 0.16);
          box-shadow: 0 10px 28px rgba(201, 168, 76, 0.14);
        }

        .role-badge {
          display: flex;
          height: 34px;
          width: 34px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          font-size: 10px;
          font-weight: 850;
        }

        .role-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12.6px;
          line-height: 1;
          font-weight: 850;
          color: #1e293b;
        }

        .dark .role-name {
          color: #f1f5f9;
        }

        .role-description {
          margin-top: 5px;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10.2px;
          line-height: 1;
          font-weight: 500;
          color: #64748b;
        }

        .dark .role-description {
          color: #98a8bd;
        }

        .demo-alert {
          margin-top: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border-radius: 16px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(248, 250, 252, 0.92);
          padding: 11px 14px;
          color: #475569;
          font-size: 11.4px;
          line-height: 1.25;
          font-weight: 550;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
        }

        .dark .demo-alert {
          border-color: rgba(73, 92, 128, 0.72);
          background: rgba(14, 25, 48, 0.82);
          color: #b7c4d6;
        }

        .login-label {
          display: block;
          margin-bottom: 7px;
          font-size: 11.5px;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #475569;
        }

        .dark .login-label {
          color: #c7d2e3;
        }

        .login-input {
          height: 46px !important;
          border-radius: 13px !important;
          border: 1px solid #dbe4ef !important;
          background: #f8fafc !important;
          padding-left: 16px !important;
          padding-right: 16px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          transition: all 220ms ease !important;
        }

        .login-input::placeholder {
          color: #94a3b8 !important;
        }

        .login-input:focus {
          border-color: #0f2d55 !important;
          box-shadow: 0 0 0 4px rgba(15, 45, 85, 0.12) !important;
        }

        .dark .login-input {
          border-color: rgba(73, 92, 128, 0.8) !important;
          background: rgba(5, 12, 28, 0.88) !important;
          color: #f8fafc !important;
        }

        .dark .login-input::placeholder {
          color: #7d8ca4 !important;
        }

        .dark .login-input:focus {
          border-color: #5b8ee6 !important;
          box-shadow: 0 0 0 4px rgba(91, 142, 230, 0.18) !important;
        }

        .login-input-highlight {
          border-color: rgba(16, 185, 129, 0.7) !important;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12) !important;
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          border-radius: 10px;
          padding: 8px;
          color: #64748b;
          transition: all 180ms ease;
        }

        .password-toggle:hover {
          background: rgba(226, 232, 240, 0.85);
          color: #334155;
        }

        .dark .password-toggle {
          color: #93a4bc;
        }

        .dark .password-toggle:hover {
          background: rgba(36, 50, 78, 0.85);
          color: #e2e8f0;
        }

        .error-box {
          margin-bottom: 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          border-radius: 16px;
          border: 1px solid #fee2e2;
          background: #fef2f2;
          padding: 14px;
          animation: shake 0.4s ease-in-out;
        }

        .error-box p {
          margin: 0;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 550;
          color: #b91c1c;
        }

        .dark .error-box {
          border-color: rgba(127, 29, 29, 0.55);
          background: rgba(127, 29, 29, 0.20);
        }

        .dark .error-box p {
          color: #fca5a5;
        }

        .login-button {
          position: relative !important;
          margin-top: 6px !important;
          height: 49px !important;
          width: 100% !important;
          overflow: hidden !important;
          border-radius: 16px !important;
          gap: 12px !important;
          background: #0f2d55 !important;
          color: #ffffff !important;
          font-size: 13.5px !important;
          font-weight: 850 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          box-shadow: 0 12px 26px rgba(15, 45, 85, 0.25) !important;
          transition: all 220ms ease !important;
        }

        .login-button:hover {
          transform: translateY(-1px) scale(1.005) !important;
          background: #153e74 !important;
          box-shadow: 0 16px 34px rgba(15, 45, 85, 0.32) !important;
        }

        .dark .login-button {
          background: linear-gradient(135deg, #c9a84c 0%, #e2c66e 100%) !important;
          color: #06101f !important;
          box-shadow: 0 12px 28px rgba(201, 168, 76, 0.22) !important;
        }

        .dark .login-button:hover {
          background: linear-gradient(135deg, #d6b75f 0%, #ecd486 100%) !important;
          box-shadow: 0 16px 36px rgba(201, 168, 76, 0.34) !important;
        }

        .login-button:disabled {
          opacity: 0.62 !important;
          cursor: not-allowed !important;
          transform: none !important;
        }

        .login-button-shine {
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
          transition: transform 900ms ease;
        }

        .login-button:hover .login-button-shine {
          transform: translateX(100%);
        }

        .login-footer {
          margin-top: 16px;
          border-top: 1px solid rgba(226, 232, 240, 0.95);
          padding-top: 13px;
          text-align: center;
          font-size: 10.5px;
          font-weight: 500;
          color: #64748b;
        }

        .dark .login-footer {
          border-color: rgba(73, 92, 128, 0.7);
          color: #8290a6;
        }

        @media (min-width: 1024px) and (max-height: 850px) {
          .login-card-wrap {
            transform: scale(0.94);
          }

          .login-card-inner {
            padding: 24px 34px;
          }

          .login-title {
            font-size: 24px;
          }

          .login-subtitle {
            font-size: 13px;
          }

          .role-card {
            padding: 10.5px 12px;
          }

          .demo-alert {
            margin-top: 12px;
            padding: 10px 13px;
          }

          .login-input {
            height: 44px !important;
          }

          .login-button {
            height: 47px !important;
          }

          .login-footer {
            margin-top: 14px;
            padding-top: 12px;
          }
        }

        @media (min-width: 1024px) and (min-height: 900px) {
          .login-card-wrap {
            transform: scale(0.96);
          }
        }

        @media (max-width: 1023px) {
          .login-page {
            overflow-y: auto;
          }

          .login-right {
            min-height: 100vh;
          }

          .login-card-wrap {
            width: min(100%, 620px);
            max-width: 620px;
            transform: none;
          }

          .login-card-inner {
            padding: 28px 24px;
          }
        }

        @media (max-width: 640px) {
          .login-card {
            border-radius: 22px;
          }

          .login-card-inner {
            padding: 24px 18px;
          }

          .login-title {
            font-size: 24px;
          }

          .login-subtitle {
            font-size: 13px;
          }

          .role-card {
            padding: 12px;
          }

          .role-name {
            font-size: 12.5px;
          }

          .role-description {
            font-size: 10px;
          }
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-4px);
          }
          75% {
            transform: translateX(4px);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}