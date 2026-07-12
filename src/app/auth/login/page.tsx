'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, LogIn, Loader2, CheckCircle2, Lock, Mail
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClientError } from '@/lib/api-client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export default function LoginPage() {
  const { login, user } = useAuth();
  const { isDark } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const [canvasOpacity, setCanvasOpacity] = useState(0);
  const [renderCanvas, setRenderCanvas] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // Functional security states
  const [loginError, setLoginError] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  const [formShake, setFormShake] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockUntil && lockUntil > Date.now()) return;
    setError('');
    setLoginError(false);
    setLoading(true);

    // Simulate 900ms processing delay to show loading state
    await new Promise((resolve) => setTimeout(resolve, 900));

    try {
      await login(email, password);
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
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed left-1/2 top-6 z-50 transition-all duration-300"
          >
            <div className="login-toast">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                <CheckCircle2 className="h-3 w-3 text-white" strokeWidth={3} />
              </div>
              <span className="text-[13px] font-medium">
                {toast.message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PANEL IZQUIERDO */}
      <div className="login-left-panel relative hidden overflow-hidden lg:flex lg:h-full lg:flex-col lg:justify-between lg:w-[45%]">
        {/* Capa de la imagen de fondo animada */}
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/imagenes/fondo-login.jpg')",
          }}
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Capa de oscurecimiento y gradiente azul-oro */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/80 via-slate-950/30 to-slate-900/10 pointer-events-none" />

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

        {/* RED DE NODOS DIGITALES ANIMADOS (SÓLO MODO OSCURO) */}
        <svg className="absolute bottom-24 left-8 w-64 h-32 opacity-35 pointer-events-none stroke-current text-[#e4c975] hidden dark:block z-10" viewBox="0 0 240 120" fill="none">
          <motion.path 
            d="M 20,110 L 80,70 L 160,50 L 220,15" 
            strokeWidth="1.2" 
            strokeDasharray="3,3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.2, ease: "easeInOut" }}
          />
          <motion.path 
            d="M 80,70 L 120,105 L 190,75 L 220,15" 
            strokeWidth="1.2" 
            strokeDasharray="3,3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.8, ease: "easeInOut", delay: 0.6 }}
          />
          <circle cx="20" cy="110" r="3.5" fill="#e4c975" className="animate-pulse" />
          <circle cx="80" cy="70" r="4" fill="#e4c975" />
          <circle cx="160" cy="50" r="3" fill="#e4c975" />
          <circle cx="220" cy="15" r="5" fill="#e2c66e" className="animate-ping" style={{ animationDuration: '3s' }} />
          <circle cx="220" cy="15" r="4" fill="#e4c975" />
          <circle cx="120" cy="105" r="3" fill="#e4c975" />
          <circle cx="190" cy="75" r="3.5" fill="#e4c975" className="animate-pulse" />
        </svg>

        {/* Barra translúcida inferior con la identidad institucional */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-8 pb-8 pt-24 flex flex-col">
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
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
          </motion.p>
          <motion.h3 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-2xl font-black text-white tracking-wide leading-tight"
          >
            Escuela de Ingeniería de Sistemas
          </motion.h3>
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-xs text-white/70 mt-1.5 font-medium"
          >
            Sistema de Gestión de Horarios Académicos
          </motion.p>
        </div>
      </div>

      {/* BANNER MÓVIL (SÓLO VISIBLE EN MÓVIL) */}
      <div 
        className="relative w-full h-40 shrink-0 lg:hidden flex flex-col justify-end p-5 overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/imagenes/fondo-login.jpg')",
          }}
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-900/40 pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/95 border border-slate-200/80 shadow-md p-2">
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
            <h3 className="text-base font-extrabold text-white tracking-wide leading-tight">
              Escuela de Ingeniería de Sistemas
            </h3>
            <p className="text-[11px] text-white/80 font-medium mt-0.5">
              Sistema de Gestión de Horarios
            </p>
          </div>
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="login-right relative flex flex-1 flex-col items-center justify-center overflow-y-auto lg:overflow-y-auto lg:overflow-x-hidden px-6 py-8 transition-colors duration-300 lg:h-full lg:px-8 lg:py-0">
        <div className="login-right-bg" />
        <div className="login-right-grid" />
        <div className="login-right-glow-one" />
        <div className="login-right-glow-two" />

        <div className="absolute right-6 top-6 z-20">
          <ThemeToggle variant="login" />
        </div>

        {/* CARD */}
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          className="login-card-wrap relative z-10 w-full"
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="login-card relative overflow-hidden">
            {/* Fondo spotlight interactivo */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(350px_circle_at_var(--mouse-x,0px)_var(--mouse-y,0px),rgba(99,102,241,0.06),transparent_80%)] dark:bg-[radial-gradient(350px_circle_at_var(--mouse-x,0px)_var(--mouse-y,0px),rgba(228,201,117,0.05),transparent_80%)]" />
            
            <div className="login-card-inner">
              {/* HEADER (VISIBLE EN ESCRITORIO) */}
              <div className="hidden lg:flex flex-col items-center mb-6">
                <motion.div 
                  className="relative flex items-center justify-center w-24 h-24 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-md shadow-slate-100/50 dark:shadow-none p-3.5 mb-3 transition-transform duration-300 hover:scale-105"
                  whileHover={{ scale: 1.05, rotate: 2 }}
                >
                  <Image
                    src="/logo-unt.png"
                    alt="Logo Universidad Nacional de Trujillo"
                    width={68}
                    height={68}
                    className="object-contain"
                    priority
                  />
                </motion.div>
                
                <div className="w-full text-center flex flex-col items-center">
                  <h2 className="login-title tracking-tight">
                    Acceso al Sistema
                  </h2>
                </div>
              </div>

              {/* HEADER MÓVIL (COMPACTO Y MÁS ESTILIZADO) */}
              <div className="lg:hidden mb-6 text-center flex flex-col items-center">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Acceso al Sistema
                </h2>
              </div>

              {/* Network/server error box (above form) */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    className="error-box" 
                    role="alert"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    </div>
                    <p>{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <form
                onSubmit={handleSubmit}
                className={`flex flex-col gap-5 ${formShake ? 'form-shake' : ''}`}
                noValidate
              >
                {/* Email */}
                <div className="flex flex-col gap-2.5">
                  <label htmlFor="email" className="login-label">
                    Correo electrónico
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400 dark:text-slate-500 pointer-events-none z-10 flex items-center justify-center">
                      <Mail className="h-4 w-4" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@unitru.edu.pe"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (loginError) setLoginError(false);
                      }}
                      required
                      autoComplete="email"
                      aria-describedby={loginError ? 'login-error-msg' : undefined}
                      aria-invalid={loginError}
                      className={`login-input pl-11 ${loginError ? 'login-input-error' : ''}`}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-2.5">
                  <div className="mb-2 flex items-center justify-between">
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

                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400 dark:text-slate-500 pointer-events-none z-10 flex items-center justify-center">
                      <Lock className="h-4 w-4" />
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (loginError) setLoginError(false);
                      }}
                      onKeyUp={detectCapsLock}
                      onKeyDown={detectCapsLock}
                      required
                      autoComplete="current-password"
                      aria-describedby={loginError ? 'login-error-msg' : undefined}
                      aria-invalid={loginError}
                      className={`login-input pl-11 ${capsLock ? 'pr-24' : 'pr-12'} ${loginError ? 'login-input-error' : ''}`}
                    />

                    <AnimatePresence>
                      {capsLock && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider pointer-events-none select-none z-10"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Mayús
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="password-toggle"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4.5 w-4.5" />
                      ) : (
                        <Eye className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </div>

                  {/* Credential error message — below password field */}
                  <AnimatePresence>
                    {loginError && !lockUntil && (
                      <motion.p
                        id="login-error-msg"
                        className="login-error-msg"
                        role="alert"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                      >
                        Correo o contraseña incorrectos. Intenta de nuevo.
                      </motion.p>
                    )}
                  </AnimatePresence>
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
                <AnimatePresence>
                  {lockUntil && lockSecondsLeft > 0 && (
                    <motion.div 
                      className="lockout-box" 
                      role="alert" 
                      aria-live="polite"
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  type="submit"
                  disabled={loading || !email || !password || (!!lockUntil && lockSecondsLeft > 0)}
                  className="login-button relative"
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
        </motion.div>
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
            radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.07) 0%, transparent 42%),
            radial-gradient(circle at 0% 100%, rgba(201, 168, 76, 0.05) 0%, transparent 45%);
        }

        .login-right-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.35;
          background-image: radial-gradient(rgba(15, 23, 42, 0.05) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        .login-right-glow-one,
        .login-right-glow-two {
          position: absolute;
          pointer-events: none;
          display: block;
          border-radius: 999px;
        }

        .login-right-glow-one {
          right: 5%;
          top: 10%;
          height: 480px;
          width: 480px;
          opacity: 0.12;
          filter: blur(130px);
          background: radial-gradient(circle, rgba(99, 102, 241, 0.4), transparent 70%);
          animation: floatOrbOne 20s infinite ease-in-out;
        }

        .login-right-glow-two {
          left: 5%;
          bottom: 5%;
          height: 440px;
          width: 440px;
          opacity: 0.08;
          filter: blur(120px);
          background: radial-gradient(circle, rgba(228, 201, 117, 0.3), transparent 70%);
          animation: floatOrbTwo 24s infinite ease-in-out;
        }

        .dark .login-right {
          background:
            radial-gradient(circle at 88% 8%, rgba(99, 102, 241, 0.12) 0%, transparent 34%),
            radial-gradient(circle at 18% 82%, rgba(201, 168, 76, 0.08) 0%, transparent 36%),
            linear-gradient(135deg, #030712 0%, #060e1d 45%, #02050f 100%);
        }

        .dark .login-right-bg {
          background:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 42px 42px;
          opacity: 0.45;
          mask-image: radial-gradient(ellipse at center, black, transparent 78%);
          -webkit-mask-image: radial-gradient(ellipse at center, black, transparent 78%);
        }

        .dark .login-right-grid {
          opacity: 0;
        }

        .dark .login-right-glow-one {
          opacity: 0.32;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.35), transparent 70%);
        }

        .dark .login-right-glow-two {
          opacity: 0.22;
          background: radial-gradient(circle, rgba(228, 201, 117, 0.22), transparent 70%);
        }

        @keyframes floatOrbOne {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(25px, -45px) scale(1.08);
          }
          66% {
            transform: translate(-15px, 15px) scale(0.96);
          }
        }

        @keyframes floatOrbTwo {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          50% {
            transform: translate(-35px, 35px) scale(1.12);
          }
        }

        .login-card-wrap {
          width: min(100%, 460px);
          max-width: 460px;
          transform-origin: center;
        }

        .login-card {
          position: relative;
          overflow: hidden;
          border-radius: var(--card-radius);
          border: 1px solid rgba(226, 232, 240, 0.8);
          background: rgba(255, 255, 255, 0.72);
          box-shadow:
            0 25px 50px -12px rgba(15, 23, 42, 0.08),
            0 0 40px rgba(99, 102, 241, 0.02),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          transition: background 300ms ease, border-color 300ms ease, box-shadow 300ms ease;
        }

        /* Spotlight border hover effect */
        .login-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: var(--card-radius);
          padding: 1.5px;
          background: radial-gradient(
            280px circle at var(--mouse-x, 0px) var(--mouse-y, 0px),
            rgba(99, 102, 241, 0.15),
            transparent 80%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          z-index: 10;
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .login-card:hover::before {
          opacity: 1;
        }

        .dark .login-card {
          border: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(10, 20, 42, 0.65);
          box-shadow:
            0 25px 50px -12px rgba(0, 0, 0, 0.5),
            0 0 50px rgba(228, 201, 117, 0.03),
            0 1px 0 rgba(255, 255, 255, 0.04) inset;
        }

        .dark .login-card::before {
          background: radial-gradient(
            280px circle at var(--mouse-x, 0px) var(--mouse-y, 0px),
            rgba(228, 201, 117, 0.25),
            transparent 80%
          );
        }

        .login-card-inner {
          padding: 24px 20px;
        }

        @media (min-width: 640px) {
          .login-card-inner {
            padding: 36px 40px;
          }
        }

        .login-title {
          font-size: 28px;
          line-height: 1.1;
          letter-spacing: -0.03em;
          font-weight: 850;
          color: #0f172a;
          background: linear-gradient(135deg, #0f2d55 0%, #1d4ed8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .dark .login-title {
          background: linear-gradient(135deg, #f8fafc 0%, #aab8cc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .login-label {
          display: block;
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #475569;
        }

        .dark .login-label {
          color: #94a3b8;
        }

        .login-input {
          height: 48px !important;
          border-radius: 14px !important;
          border: 1px solid #dbe4ef !important;
          background: rgba(248, 250, 252, 0.8) !important;
          padding-left: 40px !important;
          padding-right: 16px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .login-input::placeholder {
          color: #64748b !important;
        }

        .login-input:hover {
          border-color: #94a3b8 !important;
          background: rgba(255, 255, 255, 0.95) !important;
        }

        .login-input:focus {
          border-color: #1d4ed8 !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 4px rgba(29, 78, 216, 0.12) !important;
        }

        .dark .login-input {
          border-color: rgba(255, 255, 255, 0.08) !important;
          background: rgba(5, 10, 24, 0.6) !important;
          color: #f8fafc !important;
        }

        .dark .login-input::placeholder {
          color: #475569 !important;
        }

        .dark .login-input:hover {
          border-color: rgba(228, 201, 117, 0.3) !important;
          background: rgba(5, 10, 24, 0.8) !important;
        }

        .dark .login-input:focus {
          border-color: #e4c975 !important;
          background: rgba(5, 10, 24, 0.9) !important;
          box-shadow: 0 0 0 4px rgba(228, 201, 117, 0.15) !important;
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
          color: #94a3b8;
        }

        .dark .password-toggle:hover {
          background: rgba(71, 85, 105, 0.4);
          color: #f8fafc;
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
          background: rgba(127, 29, 29, 0.2);
        }

        .dark .error-box p {
          color: #fca5a5;
        }

        .login-button {
          position: relative !important;
          margin-top: 18px !important;
          height: 50px !important;
          width: 100% !important;
          overflow: hidden !important;
          border-radius: 16px !important;
          gap: 12px !important;
          background: linear-gradient(135deg, #0f2d55 0%, #1d4ed8 100%) !important;
          color: #ffffff !important;
          font-size: 14px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          box-shadow: 0 10px 22px rgba(15, 45, 85, 0.15) !important;
          transition: all 220ms ease !important;
        }

        .login-button:hover {
          transform: translateY(-1px) scale(1.005) !important;
          background: linear-gradient(135deg, #0b2240 0%, #1e40af 100%) !important;
          box-shadow: 0 14px 30px rgba(15, 45, 85, 0.25) !important;
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
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
          transition: transform 1.2s ease;
        }

        .login-button:hover .login-button-shine {
          transform: translateX(100%);
        }

        .login-footer {
          margin-top: 24px;
          border-top: 1px solid rgba(226, 232, 240, 0.6);
          padding-top: 20px;
          text-align: center;
          font-size: 10.5px;
          font-weight: 550;
          color: #64748b;
        }

        .dark .login-footer {
          border-color: rgba(255, 255, 255, 0.06);
          color: #64748b;
        }

        @media (min-width: 1024px) and (max-height: 850px) {
          .login-card-wrap {
            transform: scale(0.94);
          }

          .login-card-inner {
            padding: 24px 34px;
          }

          .login-title {
            font-size: 25px;
          }

          .login-input {
            height: 44px !important;
          }

          .login-button {
            height: 47px !important;
          }

          .login-footer {
            margin-top: 18px;
            padding-top: 14px;
          }
        }

        @media (max-width: 1023px) {
          .login-page {
            flex-direction: column;
            overflow-y: auto;
            height: 100vh;
          }

          .login-right {
            min-height: calc(100vh - 160px);
            padding: 24px 16px 40px 16px;
          }

          .login-card-wrap {
            width: 100%;
            max-width: 100%;
            transform: none;
          }

          .login-card-inner {
            padding: 28px 24px;
          }
        }

        @media (max-width: 640px) {
          .login-card {
            border-radius: 20px;
          }

          .login-card-inner {
            padding: 24px 16px;
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }

        .form-shake {
          animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        .forgot-link {
          font-size: 12.5px;
          font-weight: 600;
          color: #1d4ed8;
          text-decoration: none;
          transition: color 150ms ease;
          white-space: nowrap;
        }

        .forgot-link:hover {
          text-decoration: underline;
          color: #1e40af;
        }

        .dark .forgot-link {
          color: #e4c975;
        }

        .dark .forgot-link:hover {
          color: #ecd486;
        }

        .remember-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
        }

        .remember-checkbox {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          border-radius: 6px;
          border: 1.5px solid #cbd5e1;
          cursor: pointer;
          accent-color: #1d4ed8;
        }

        .dark .remember-checkbox {
          border-color: #475569;
          accent-color: #e4c975;
        }

        .remember-label {
          font-size: 13.5px;
          font-weight: 550;
          color: #475569;
          cursor: pointer;
          user-select: none;
        }

        .dark .remember-label {
          color: #94a3b8;
        }

        .lockout-box {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          border-radius: 14px;
          border: 1px solid rgba(239, 68, 68, 0.35);
          background: rgba(254, 242, 242, 0.95);
          padding: 13px 15px;
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
      `}</style>
    </div>
  );
}