'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Eye, EyeOff, LogIn, Loader2,
  CalendarDays, GraduationCap, CheckCircle2,
  ShieldUser, UserStar, UserCog, BookUser, UserCheck, Lock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClientError } from '@/lib/api-client';
import { DEMO_USERS } from '@/lib/demo-users';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import type { DemoUser } from '@/lib/demo-users';

const ROLE_DETAILS: Record<string, {
  icon: React.ComponentType<any>;
  badgeClass: string;
  dot: string;
}> = {
  admin: {
    icon: ShieldUser,
    badgeClass: 'bg-purple-50 text-purple-600 dark:bg-purple-800/50 dark:text-purple-200',
    dot: '#a78bfa'
  },
  secretaria: {
    icon: UserStar,
    badgeClass: 'bg-blue-50 text-blue-600 dark:bg-blue-800/50 dark:text-blue-200',
    dot: '#3b82f6'
  },
  operador: {
    icon: UserCog,
    badgeClass: 'bg-amber-50 text-amber-600 dark:bg-amber-800/50 dark:text-amber-200',
    dot: '#f59e0b'
  },
  docente: {
    icon: BookUser,
    badgeClass: 'bg-teal-50 text-teal-600 dark:bg-teal-800/50 dark:text-teal-200',
    dot: '#10b981'
  },
  monitor: {
    icon: UserCheck,
    badgeClass: 'bg-rose-50 text-rose-600 dark:bg-rose-800/50 dark:text-rose-200',
    dot: '#ec4899'
  }
};

export default function LoginPage() {
  const { login, user } = useAuth();
  const { isDark } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [dateTimeStr, setDateTimeStr] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [canvasOpacity, setCanvasOpacity] = useState(0);
  const [renderCanvas, setRenderCanvas] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const [clickedRole, setClickedRole] = useState<string | null>(null);
  const [roleToast, setRoleToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const roleToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimerRef = useRef<{ emailTimeouts?: NodeJS.Timeout[]; passwordTimeouts?: NodeJS.Timeout[] }>({});

  // Functional security states
  const [loginError, setLoginError] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  const [formShake, setFormShake] = useState(false);

  const typeInput = (targetText: string, setter: (val: string) => void, startDelay = 0, onComplete?: () => void) => {
    const timeouts: NodeJS.Timeout[] = [];
    for (let i = 0; i <= targetText.length; i++) {
      const t = setTimeout(() => {
        setter(targetText.slice(0, i));
        if (i === targetText.length && onComplete) {
          onComplete();
        }
      }, startDelay + i * 15);
      timeouts.push(t);
    }
    return timeouts;
  };

  useEffect(() => {
    setMounted(true);

    const now = new Date();
    let h = now.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    const m = now.getMinutes().toString().padStart(2, '0');
    setLastUpdated(`${h}:${m} ${ap}`);

    const updateDateTime = () => {
      const nowTime = new Date();
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const dayName = days[nowTime.getDay()];
      const dayNum = nowTime.getDate();
      const monthName = months[nowTime.getMonth()];
      let hours = nowTime.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutes = nowTime.getMinutes().toString().padStart(2, '0');
      setDateTimeStr(`${dayName}, ${dayNum} ${monthName} · ${hours}:${minutes} ${ampm}`);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isDark) {
      setRenderCanvas(true);
      const t = setTimeout(() => {
        setCanvasOpacity(1);
      }, 300);
      return () => clearTimeout(t);
    } else {
      setCanvasOpacity(0);
      const t = setTimeout(() => {
        setRenderCanvas(false);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isDark, mounted]);

  useEffect(() => {
    if (!renderCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      } else {
        canvas.width = canvas.clientWidth || canvas.offsetWidth || 300;
        canvas.height = canvas.clientHeight || canvas.offsetHeight || 150;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      alphaSpeed: number;

      constructor(w: number, h: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.05;
        this.vy = (Math.random() - 0.5) * 0.05;
        this.radius = Math.random() * 1.5 + 1;
        this.alpha = Math.random() * 0.2 + 0.1;
        this.alphaSpeed = (Math.random() * 0.002 + 0.001) * (Math.random() > 0.5 ? 1 : -1);
      }

      update(w: number, h: number) {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > w) this.vx = -this.vx;
        if (this.y < 0 || this.y > h) this.vy = -this.vy;

        this.alpha += this.alphaSpeed;
        if (this.alpha < 0.1 || this.alpha > 0.3) {
          this.alphaSpeed = -this.alphaSpeed;
        }
      }

      draw(cContext: CanvasRenderingContext2D) {
        cContext.beginPath();
        cContext.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        cContext.fillStyle = `rgba(228, 201, 117, ${this.alpha})`;
        cContext.fill();
      }
    }

    const particleCount = 15;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(canvas.width, canvas.height));
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'screen';
      particles.forEach((p) => {
        p.update(canvas.width, canvas.height);
        p.draw(ctx);
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [renderCanvas]);

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


  // Lockout countdown
  useEffect(() => {
    if (!lockUntil) return;
    const tick = () => {
      const secsLeft = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockSecondsLeft(secsLeft);
      if (secsLeft === 0) {
        setLockUntil(null);
        setFailedAttempts(0);
        setLoginError(false);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  // Clear formShake class after animation completes
  useEffect(() => {
    if (formShake) {
      const t = setTimeout(() => setFormShake(false), 400);
      return () => clearTimeout(t);
    }
  }, [formShake]);

  const fillDemo = (u: DemoUser) => {
    setClickedRole(u.id);
    setTimeout(() => {
      setClickedRole(null);
    }, 150);

    if (roleToastTimeoutRef.current) {
      clearTimeout(roleToastTimeoutRef.current);
    }
    setRoleToast({ visible: true, message: `Rol seleccionado: ${u.label}` });
    roleToastTimeoutRef.current = setTimeout(() => {
      setRoleToast((prev) => ({ ...prev, visible: false }));
    }, 2000);

    setSelectedDemo(u.id);
    setError('');
    setLoginError(false);
    
    // Clear previous typing intervals (safety/cleanup)
    if (typingTimerRef.current.emailTimeouts) {
      typingTimerRef.current.emailTimeouts.forEach(clearTimeout);
    }
    if (typingTimerRef.current.passwordTimeouts) {
      typingTimerRef.current.passwordTimeouts.forEach(clearTimeout);
    }

    // Start typing animation for credentials
    setEmail('');
    setPassword('');

    const emailTimeouts = typeInput(u.email, setEmail, 0, () => {
      const passwordTimeouts = typeInput(u.password, setPassword, 100);
      typingTimerRef.current.passwordTimeouts = passwordTimeouts;
    });
    typingTimerRef.current.emailTimeouts = emailTimeouts;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockUntil && lockUntil > Date.now()) return;
    setError('');
    setLoginError(false);
    setLoading(true);

    // Simulate 900ms processing delay to show loading state
    await new Promise((resolve) => setTimeout(resolve, 900));

    try {
      let loginEmail = email;
      let loginPassword = password;

      if (selectedDemo) {
        const demoUser = DEMO_USERS.find((u) => u.id === selectedDemo);
        if (demoUser) {
          loginEmail = demoUser.email;
          loginPassword = demoUser.password;
        }
      }

      await login(loginEmail, loginPassword);
      // On success, store rememberMe preference and reset failed attempts
      setFailedAttempts(0);
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }
    } catch (err) {
      const isCredentialError = err instanceof ApiClientError &&
        (err.message.toLowerCase().includes('credencial') ||
         err.message.toLowerCase().includes('contrase') ||
         err.message.toLowerCase().includes('invalid') ||
         err.message.toLowerCase().includes('incorrecto') ||
         err.message.toLowerCase().includes('401') ||
         (err as any).status === 401);

      if (isCredentialError) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        setLoginError(true);
        setFormShake(true);
        if (newAttempts >= 5) {
          setLockUntil(Date.now() + 5 * 60 * 1000);
        }
      } else {
        // Network or server error — show generic message, don't count as credential failure
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Error de conexión. Verifique que el servidor esté funcionando.'
        );
      }
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

      {/* TOAST ROL SELECCIONADO (ABAJO A LA DERECHA) */}
      <div
        className={`fixed right-6 bottom-6 z-50 transition-all duration-300 ${roleToast.visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-4 opacity-0'
          }`}
      >
        <div className="role-toast-box">
          <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#c9a84c] text-[#06101f]">
            <CheckCircle2 className="h-3 w-3 text-[#06101f]" strokeWidth={3.5} />
          </div>
          <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200">
            {roleToast.message}
          </span>
        </div>
      </div>

      {/* PANEL IZQUIERDO */}
      <div
        className="login-left-panel relative hidden overflow-hidden lg:flex lg:h-full lg:flex-col lg:justify-between"
        style={{
          width: '45%',
          backgroundImage: "url('/imagenes/fondo-login.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Capa de oscurecimiento suave sobre la imagen */}
        <div className="absolute inset-0 bg-slate-950/20 pointer-events-none" />

        {/* EFECTO DE PARTÍCULAS (SÓLO MODO OSCURO, TERCIO SUPERIOR) */}
        {renderCanvas && (
          <canvas
            ref={canvasRef}
            className="absolute inset-x-0 top-0 w-full pointer-events-none z-10"
            style={{
              height: '33.333333%',
              opacity: canvasOpacity,
              transition: `opacity ${canvasOpacity === 0 ? '400ms ease-in' : '600ms ease-out'}`,
              mixBlendMode: 'screen',
            }}
          />
        )}

        {/* RED DE NODOS DIGITALES (SÓLO MODO OSCURO, ESQUINA INFERIOR IZQUIERDA) */}
        <svg className="absolute bottom-24 left-8 w-64 h-32 opacity-25 pointer-events-none stroke-current text-[#e4c975] hidden dark:block z-10" viewBox="0 0 240 120" fill="none">
          <path d="M 20,110 L 80,70 L 160,50 L 220,15" strokeWidth="1" strokeDasharray="3,3" />
          <path d="M 80,70 L 120,105 L 190,75 L 220,15" strokeWidth="1" strokeDasharray="3,3" />
          <circle cx="20" cy="110" r="3" fill="#e4c975" className="animate-pulse" />
          <circle cx="80" cy="70" r="3.5" fill="#e4c975" />
          <circle cx="160" cy="50" r="2.5" fill="#e4c975" />
          <circle cx="220" cy="15" r="4.5" fill="#e2c66e" className="animate-ping" style={{ animationDuration: '3s' }} />
          <circle cx="220" cy="15" r="3.5" fill="#e4c975" />
          <circle cx="120" cy="105" r="2.5" fill="#e4c975" />
          <circle cx="190" cy="75" r="3" fill="#e4c975" className="animate-pulse" />
        </svg>

        {/* Barra translúcida inferior con la identidad institucional */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-black/60 backdrop-blur-md px-8 py-6 border-t border-white/10 flex flex-col">
          <p
            style={{
              fontSize: 10,
              letterSpacing: '2.5px',
              color: '#e4c975',
              textTransform: 'uppercase',
              fontWeight: 800,
              marginBottom: '4px',
            }}
          >
            Universidad Nacional de Trujillo
          </p>
          <h3 className="text-xl font-bold text-white tracking-wide leading-tight">
            Escuela de Ingeniería de Sistemas
          </h3>
          <p className="text-xs text-white/60 mt-1">
            Sistema de Gestión de Horarios Académicos
          </p>
        </div>
      </div>

      {/* BANNER MÓVIL (SÓLO VISIBLE EN MÓVIL) */}
      <div 
        className="relative w-full h-48 shrink-0 lg:hidden flex flex-col justify-center px-6 overflow-hidden"
        style={{
          backgroundImage: "url('/imagenes/fondo-login.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/95 border border-slate-200 shadow-md p-2">
            <Image
              src="/logo-unt.png"
              alt="Logo UNT"
              width={38}
              height={38}
              className="object-contain"
            />
          </div>
          <div>
            <p className="text-[9px] tracking-[1.8px] text-[#e4c975] uppercase font-black leading-none mb-1">
              Universidad Nacional de Trujillo
            </p>
            <h3 className="text-sm font-bold text-white tracking-wide leading-tight">
              Escuela de Ingeniería de Sistemas
            </h3>
            <p className="text-[10.5px] text-white/70">
              Sistema de Gestión de Horarios
            </p>
          </div>
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="login-right relative flex flex-1 flex-col items-center justify-start lg:justify-center overflow-y-auto lg:overflow-y-auto lg:overflow-x-hidden px-5 py-8 lg:px-8 lg:py-0 transition-colors duration-300 lg:h-full z-20 -mt-8 lg:mt-0 rounded-t-[32px] lg:rounded-none shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:shadow-none bg-white dark:bg-[#020617] lg:bg-transparent">
        <div className="login-right-bg" />
        <div className="login-right-grid" />
        <div className="login-right-glow-one" />
        <div className="login-right-glow-two" />

        <div className="absolute right-6 top-6 z-20">
          <ThemeToggle variant="login" />
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
              {/* HEADER (VISIBLE EN ESCRITORIO) */}
              <div className="hidden lg:flex flex-col items-center mb-5">
                <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-md shadow-slate-100/50 dark:shadow-none p-3.5 mb-2.5 transition-transform duration-300 hover:scale-105">
                  <Image
                    src="/logo-unt.png"
                    alt="Logo Universidad Nacional de Trujillo"
                    width={68}
                    height={68}
                    className="object-contain"
                    priority
                  />
                </div>
                
                <div className="w-full text-center flex flex-col items-center">
                  <h2 className="login-title tracking-tight">
                    Acceso al Sistema
                  </h2>             
                </div>
              </div>

              {/* HEADER MÓVIL (COMPACTO Y MÁS ESTILIZADO) */}
              <div className="lg:hidden mb-5 text-center flex flex-col items-center">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Acceso al Sistema
                </h2>
              </div>

              {/* ROLES (Ocultos a petición del usuario) */}
              <div className="mb-6 hidden">
                <div className="role-cards-grid grid grid-cols-2 gap-3 lg:grid-cols-6">
                  {DEMO_USERS.map((u, idx) => {
                    const c = ROLE_DETAILS[u.id] ?? ROLE_DETAILS.admin;
                    const IconComponent = c.icon;
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
                        style={{ animationDelay: `${idx * 60}ms` }}
                        className={`role-card ${sel ? 'role-card-selected' : ''} ${clickedRole === u.id ? 'role-card-clicking' : ''} ${colSpan}`}
                        aria-label={`Acceso rápido como ${u.label}`}
                        aria-pressed={sel}
                      >
                        <div
                          className={`role-badge ${sel ? '!bg-[#c9a84c] !text-[#06101f]' : c.badgeClass}`}
                          style={{
                            border: sel ? '1px solid #e4c975' : '1px solid transparent',
                          }}
                        >
                          <IconComponent className="h-[18px] w-[18px] role-icon-inner" />
                        </div>

                        <div className="flex min-w-0 text-left flex-1 items-center">
                          <span className="role-name truncate">
                            {u.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>



              {/* Network/server error box (above form) */}
              {error && (
                <div className="error-box" role="alert">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  </div>
                  <p>{error}</p>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className={`flex flex-col gap-4 ${formShake ? 'form-shake' : ''}`}
                noValidate
              >
                {/* Email */}
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
                      if (loginError) setLoginError(false);
                    }}
                    onFocus={() => setSelectedDemo(null)}
                    required
                    autoComplete="email"
                    aria-describedby={loginError ? 'login-error-msg' : undefined}
                    aria-invalid={loginError}
                    className={`login-input ${loginError ? 'login-input-error' : ''}`}
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="login-label mb-0">
                      Contraseña
                    </label>
                    <a
                      href="/recuperar-contrasena"
                      className="forgot-link"
                      tabIndex={0}
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>

                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setSelectedDemo(null);
                        if (loginError) setLoginError(false);
                      }}
                      onFocus={() => setSelectedDemo(null)}
                      onKeyUp={detectCapsLock}
                      onKeyDown={detectCapsLock}
                      required
                      autoComplete="current-password"
                      aria-describedby={loginError ? 'login-error-msg' : undefined}
                      aria-invalid={loginError}
                      className={`login-input ${capsLock ? 'pr-24' : 'pr-12'} ${loginError ? 'login-input-error' : ''}`}
                    />

                    {capsLock && (
                      <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider pointer-events-none select-none">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Mayús
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="password-toggle"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {/* Credential error message — below password field */}
                  {loginError && !lockUntil && (
                    <p
                      id="login-error-msg"
                      className="login-error-msg"
                      role="alert"
                    >
                      Correo o contraseña incorrectos. Intenta de nuevo.
                    </p>
                  )}
                </div>

                {/* Remember me */}
                <div className="remember-row">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="remember-checkbox"
                  />
                  <label htmlFor="remember-me" className="remember-label">
                    Recordarme en este dispositivo
                  </label>
                </div>

                {/* Lockout countdown */}
                {lockUntil && lockSecondsLeft > 0 && (
                  <div className="lockout-box" role="alert" aria-live="polite">
                    <div className="lockout-icon">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="lockout-title">Cuenta bloqueada temporalmente</p>
                      <p className="lockout-sub">
                        Demasiados intentos fallidos. Intenta nuevamente en{' '}
                        <span className="lockout-countdown" aria-live="polite">
                          {Math.floor(lockSecondsLeft / 60)}:{String(lockSecondsLeft % 60).padStart(2, '0')}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || (!selectedDemo && (!email || !password)) || (!!lockUntil && lockSecondsLeft > 0)}
                  className="login-button"
                >
                  <span className="login-button-shine" />

                  {loading ? (
                    <>
                      <Loader2 className="relative z-10 h-5 w-5 animate-spin" />
                      <span className="relative z-10 normal-case tracking-normal">
                        Ingresando...
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

              {/* FOOTER CON COPYRIGHT */}
              <div className="login-footer flex flex-col items-center gap-1.5 mt-6">
                <p>
                  © {new Date().getFullYear()} Universidad Nacional de Trujillo · Departamento de Sistemas
                </p>
              </div>
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
          position: relative;
          transition: background 300ms ease, border-color 300ms ease;
        }

        @media (min-width: 1024px) {
          .login-right {
            height: 100vh !important;
            max-height: 100vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }

          .login-left-panel {
            height: 100vh !important;
            max-height: 100vh !important;
          }
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
          transition: background 300ms ease, border-color 300ms ease, box-shadow 300ms ease;
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
        }

        .login-section-title div:first-child {
          background: linear-gradient(to right, transparent, rgba(203, 213, 225, 0.9));
        }

        .login-section-title div:last-child {
          background: linear-gradient(to left, transparent, rgba(203, 213, 225, 0.9));
        }

        .login-section-title span {
          font-size: 10.5px;
          font-weight: 850;
          letter-spacing: 2.45px;
          text-transform: uppercase;
          color: #64748b;
          white-space: nowrap;
        }

        .dark .login-section-title div:first-child {
          background: linear-gradient(to right, transparent, rgba(73, 92, 128, 0.72));
        }

        .dark .login-section-title div:last-child {
          background: linear-gradient(to left, transparent, rgba(73, 92, 128, 0.72));
        }

        .dark .login-section-title span {
          color: #8fa2bd;
        }

        .role-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 16px;
          border: 1px solid rgba(203, 213, 225, 0.85);
          background: rgba(248, 250, 252, 0.92);
          text-align: left;
          transition: all 200ms ease !important;
          animation: slideUp 300ms ease-out backwards;
        }

        .role-card:hover {
          transform: translateY(-2px);
          border-color: rgba(201, 168, 76, 0.45) !important;
          background: rgba(255, 255, 255, 1);
          box-shadow: 
            0 8px 16px -4px rgba(15, 23, 42, 0.08), 
            0 4px 6px -4px rgba(15, 23, 42, 0.03) !important;
        }

        .dark .role-card {
          border-color: rgba(73, 92, 128, 0.72);
          background: rgba(16, 28, 52, 0.78);
        }

        .dark .role-card:hover {
          border-color: rgba(201, 168, 76, 0.5) !important;
          background: rgba(22, 38, 70, 0.95);
          box-shadow: 
            0 10px 20px -5px rgba(0, 0, 0, 0.25) !important;
        }

        .role-card-selected {
          border-color: rgba(201, 168, 76, 0.95) !important;
          background: rgba(201, 168, 76, 0.08) !important;
          box-shadow: 
            0 12px 24px rgba(201, 168, 76, 0.12),
            0 0 0 1px rgba(201, 168, 76, 0.4) inset !important;
        }

        .dark .role-card-selected {
          border-color: rgba(228, 201, 117, 0.85) !important;
          background: rgba(201, 168, 76, 0.12) !important;
          box-shadow: 
            0 14px 28px rgba(201, 168, 76, 0.14),
            0 0 0 1px rgba(228, 201, 117, 0.3) inset !important;
        }

        .role-card-clicking {
          transform: scale(0.97) !important;
          box-shadow: none !important;
        }

        .role-badge {
          display: flex;
          height: 34px;
          width: 34px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
        }

        .role-icon-inner {
          transition: transform 150ms ease-out;
        }

        .role-card:hover .role-icon-inner {
          transform: scale(1.08);
        }

        .role-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13.5px;
          line-height: 1.2;
          font-weight: 800;
          color: #1e293b;
        }

        .dark .role-name {
          color: #f1f5f9;
        }

        .role-toast-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          backdrop-filter: blur(8px);
        }

        .dark .role-toast-box {
          border-color: rgba(36, 50, 78, 0.85);
          background: rgba(15, 23, 42, 0.95);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }

        .login-label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
        }

        .dark .login-label {
          color: #b8c7dc;
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
          color: #576880 !important; /* higher contrast slate for WCAG AA */
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
          color: #94a3b8 !important; /* higher contrast placeholder for WCAG AA */
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
          background: #1e293b !important;
          color: #ffffff !important;
          font-size: 13.5px !important;
          font-weight: 850 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08) !important;
          transition: all 220ms ease !important;
        }

        .login-button:hover {
          transform: translateY(-1px) scale(1.005) !important;
          background: #0f172a !important;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.15) !important;
        }

        .dark .login-button {
          background: linear-gradient(135deg, #c9a84c 0%, #e2c66e 100%) !important;
          color: #06101f !important;
          box-shadow: 0 12px 26px rgba(201, 168, 76, 0.22) !important;
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
          font-weight: 550;
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
            padding: 7px 10px;
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
            flex-direction: column;
            overflow-y: auto;
            height: 100vh;
          }

          .login-right {
            min-height: calc(100vh - 144px);
            padding: 20px 16px 36px 16px;
          }

          .login-card-wrap {
            width: 100%;
            max-width: 100%;
            transform: none;
          }

          .login-card-inner {
            padding: 24px 20px;
          }

          .role-card {
            padding: 6px 10px;
            gap: 8px;
          }

          .role-name {
            font-size: 12px;
          }

          .role-badge {
            height: 28px;
            width: 28px;
            font-size: 9px;
            border-radius: 8px;
          }
        }

        @media (max-width: 640px) {
          .login-card {
            border-radius: 20px;
          }

          .login-card-inner {
            padding: 20px 14px;
          }

          .role-card {
            padding: 6px 8px;
            gap: 6px;
          }

          .role-badge {
            height: 26px;
            width: 26px;
            font-size: 8px;
            border-radius: 7px;
          }
        }

        @keyframes dot-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.35);
            opacity: 0;
          }
        }

        .dot-pulse {
          animation: dot-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
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

        @media (min-width: 1441px) {
          .login-right::before {
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.022;
            background-image: radial-gradient(#0f172a 1.5px, transparent 1.5px);
            background-size: 18px 18px;
            z-index: 1;
          }
          .dark .login-right::before {
            opacity: 0.026;
            background-image: radial-gradient(#ffffff 1.5px, transparent 1.5px);
          }
        }

        /* ── Error state on inputs ── */
        .login-input-error {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12) !important;
        }

        .dark .login-input-error {
          border-color: #f87171 !important;
          box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.14) !important;
        }

        .login-error-msg {
          margin-top: 6px;
          font-size: 13px;
          font-weight: 550;
          color: #dc2626;
          line-height: 1.4;
        }

        .dark .login-error-msg {
          color: #fca5a5;
        }

        /* ── Form shake on credential error ── */
        .form-shake {
          animation: shake 0.35s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        /* ── Forgot password link ── */
        .forgot-link {
          font-size: 13px;
          font-weight: 600;
          color: #378add;
          text-decoration: none;
          transition: color 150ms ease, text-decoration-color 150ms ease;
          white-space: nowrap;
        }

        .forgot-link:hover {
          text-decoration: underline;
          text-decoration-color: #378add;
          color: #2563eb;
        }

        .dark .forgot-link {
          color: #5b8ee6;
        }

        .dark .forgot-link:hover {
          color: #7aa7f0;
          text-decoration-color: #5b8ee6;
        }

        /* ── Remember me checkbox row ── */
        .remember-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: -4px;
        }

        .remember-checkbox {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          border-radius: 4px;
          border: 1.5px solid #cbd5e1;
          cursor: pointer;
          accent-color: #378add;
          transition: border-color 150ms ease;
        }

        .dark .remember-checkbox {
          border-color: #475569;
          accent-color: #5b8ee6;
        }

        .remember-label {
          font-size: 13.5px;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          user-select: none;
        }

        .dark .remember-label {
          color: #94a3b8;
        }

        /* ── Lockout warning box ── */
        .lockout-box {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          border-radius: 14px;
          border: 1px solid rgba(239, 68, 68, 0.35);
          background: rgba(254, 242, 242, 0.95);
          padding: 13px 15px;
          animation: slideUp 250ms ease-out;
        }

        .dark .lockout-box {
          border-color: rgba(248, 113, 113, 0.3);
          background: rgba(127, 29, 29, 0.18);
        }

        .lockout-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.12);
          color: #dc2626;
          margin-top: 1px;
        }

        .dark .lockout-icon {
          background: rgba(248, 113, 113, 0.15);
          color: #fca5a5;
        }

        .lockout-title {
          font-size: 13px;
          font-weight: 700;
          color: #dc2626;
          line-height: 1.3;
          margin-bottom: 2px;
        }

        .dark .lockout-title {
          color: #fca5a5;
        }

        .lockout-sub {
          font-size: 12px;
          font-weight: 500;
          color: #b91c1c;
          line-height: 1.4;
        }

        .dark .lockout-sub {
          color: #fca5a5;
        }

        .lockout-countdown {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-weight: 800;
          font-size: 13px;
          color: #dc2626;
        }

        .dark .lockout-countdown {
          color: #f87171;
        }

        /* ── Mobile: 1-column role grid at ≤480px ── */
        @media (max-width: 480px) {
          .role-cards-grid {
            grid-template-columns: 1fr !important;
          }

          .role-cards-grid > * {
            grid-column: span 1 !important;
          }
        }
      `}</style>
    </div>
  );
}