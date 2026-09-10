/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/locale';
import { Eye, EyeOff, ArrowRight, CheckCircle2, Circle, Mail, ArrowLeft, KeyRound, Loader2, Lock, Sparkles } from 'lucide-react';
import { registerUser } from '@/lib/auth';
import { signInWithGoogle } from '@/lib/googleAuth';
import { supabase } from '@/lib/supabase';
import { FloatingPathsBackground } from '@/components/ui/floating-paths';
import { cn } from '@/lib/utils';
import { Wordmark } from '@/components/Wordmark';
import { GoogleIcon } from '@/components/ui/google-icon';

// 6 individual digit inputs — paste-aware, auto-advancing
const OtpInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const focus = (i: number) => inputs.current[i]?.focus();

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      onChange(digits.map((d, idx) => idx === i ? '' : d).join(''));
      if (i > 0) focus(i - 1);
    }
  };
  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    onChange(digits.map((d, idx) => idx === i ? char : d).join(''));
    if (char && i < 5) focus(i + 1);
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted.padEnd(6, '').slice(0, 6)); focus(Math.min(pasted.length, 5)); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          id={`register-otp-digit-${i}`}
          name={`otp-digit-${i}`}
          ref={el => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1} of verification code`}
          value={d}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          className="w-11 h-14 text-center text-xl font-bold rounded-xl border border-[hsl(var(--glass-border))] bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
        />
      ))}
    </div>
  );
};


type Strength = 'weak' | 'medium' | 'strong';

const getStrength = (pwd: string): Strength | null => {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
};

const rules = [
  { label: 'Min. 8 chars',            test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter',        test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number',                  test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special char',            test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const SuccessScreen = ({ email }: { email: string }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, '');
    if (token.length < 6) { setError('Please enter the full 6-digit code.'); return; }
    setVerifying(true);
    setError('');
    try {
      // Confirms the account AND signs the user in (session is set)
      const { error: vErr } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
      if (vErr) throw vErr;
      // Carries the brand name through from GuestScanWidget's "Create free
      // account" CTA (?brand=...) so Onboarding's own brand-name step
      // doesn't ask the visitor to retype what they already typed once.
      // Also carries a pending plan choice (?plan=... from Pricing.tsx's
      // handlePlanSelect, set when an anonymous visitor picked a paid plan
      // before having an account) through onboarding to Pricing, which
      // auto-resumes checkout for it once a session exists — previously
      // this param was set but never read anywhere, so choosing a plan
      // while logged out silently dropped back to Free after signup.
      const brand = searchParams.get('brand');
      const plan = searchParams.get('plan');
      const params = new URLSearchParams();
      if (brand) params.set('brand', brand);
      if (plan) params.set('plan', plan);
      const qs = params.toString();
      navigate(qs ? `/onboarding?${qs}` : '/onboarding', { replace: true });
    } catch (err: any) {
      setError(err.message?.includes('expired') || err.message?.includes('invalid')
        ? 'Invalid or expired code. Please resend.'
        : (err.message || 'Failed to confirm the code.'));
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (resendError) {
      setError(resendError.message || 'Failed to resend the code. Please try again.');
      return;
    }
    setResent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center space-y-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          className="mx-auto w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center"
        >
          <Mail className="w-7 h-7 text-primary" />
        </motion.div>
        <div>
          <h2 className="text-2xl font-display text-foreground">Check your inbox</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            We sent a 6-digit activation code to{' '}
            <span className="text-foreground font-medium">{email}</span>.<br />
            Enter it below to activate your account.
          </p>
        </div>

        {error && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5"
          >{error}</motion.p>
        )}

        <form onSubmit={handleVerify} className="space-y-5">
          <OtpInput value={code} onChange={setCode} />
          <Button type="submit" className="w-full h-10 gap-2" disabled={verifying || code.replace(/\D/g, '').length < 6}>
            {verifying
              ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Verifying...</span>
              : <><KeyRound className="w-3.5 h-3.5" />Activate account</>}
          </Button>
        </form>

        {resent ? (
          <p className="text-xs text-green-400">✓ New code sent.</p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            {resending ? 'Sending…' : "Didn't receive a code — resend"}
          </button>
        )}
      </motion.div>
    </div>
  );
};

const Register = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');

  // Prefilled by the Landing hero's guest-scan email gate (GuestScanWidget)
  // so someone who already typed their email to unlock a scan result isn't
  // asked to type it again a moment later.
  const [email, setEmail]       = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [showCfm, setShowCfm]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const strength = useMemo(() => getStrength(password), [password]);

  const strengthConfig = {
    weak:   { label: t('password_strength_weak'),   color: 'bg-red-500',   width: 'w-1/3' },
    medium: { label: t('password_strength_medium'), color: 'bg-yellow-500',width: 'w-2/3' },
    strong: { label: t('password_strength_strong'), color: 'bg-emerald-500',width: 'w-full' },
  };
  const sc = strength ? strengthConfig[strength] : null;

  const pwdMatch = confirm.length > 0 && password === confirm;
  const pwdMismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError(t('passwords_no_match')); return; }
    setLoading(true);
    try {
      await registerUser(email, password, referralCode || undefined);
      setSuccess(true);
    } catch (err: any) {
      if (err.status === 429 || /rate limit|failed to fetch|network/i.test(err.message || '')) {
        setError('Servers are busy right now — please try again in a few seconds.');
      } else {
        setError(err.message || 'Registration error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // signInWithGoogle redirects the browser away — this only resolves on failure.
    } catch {
      setError(t('google_signin_failed'));
      setGoogleLoading(false);
    }
  };

  if (success) return <SuccessScreen email={email} />;

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left panel ── */}
      <FloatingPathsBackground
        position={0.6}
        className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between p-10 border-r border-[hsl(var(--glass-border))] bg-card/30"
      >
        <Link to="/" className="flex items-center w-fit">
          <Wordmark className="text-3xl" />
        </Link>

        <div className="space-y-8">
          <div>
            <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-[0.2em] bg-primary/10 text-primary rounded-lg border border-primary/20 mb-4">
              Free start
            </span>
            <h2 className="text-3xl font-display leading-snug text-foreground">
              3 free analyses —<br />
              <span className="text-primary">no credit card needed</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">
              Get your AI visibility score in about 15 seconds — see how ChatGPT, Claude and Gemini describe your brand.
            </p>
          </div>

          {/* Steps */}
          <ol className="space-y-5">
            {[
              { n: '01', title: 'Create account',    desc: 'Email or Google — in 30 seconds' },
              { n: '02', title: 'Enter brand name',  desc: 'Or website URL' },
              { n: '03', title: 'Get your report',   desc: 'AI visibility score + recommendations' },
            ].map(({ n, title, desc }) => (
              <li key={n} className="flex items-start gap-4">
                <span className="text-xs font-data text-primary/60 mt-0.5 w-6 shrink-0">{n}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-[11px] text-muted-foreground/50">© {new Date().getFullYear()} Presora</p>
      </FloatingPathsBackground>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-[400px] space-y-5"
        >
          {/* Top bar: mobile logo + back button */}
          <div className="flex items-center justify-between mb-2">
            <Link to="/" className="lg:hidden flex items-center">
              <Wordmark className="text-xl" />
            </Link>
            <Link
              to="/"
              className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Link>
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Free to start
            </span>
            <h1 className="text-2xl font-display text-foreground">{t('register')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('register_subtitle')}</p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="register-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('email')}</Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="register-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('password')}</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="register-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  autoComplete="new-password"
                  className="h-11 pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength bar */}
              {strength && sc && (
                <div className="space-y-2 pt-1">
                  <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full transition-all', sc.color, sc.width)}
                      layout
                    />
                  </div>
                  {/* Rules checklist */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {rules.map(({ label, test }) => {
                      const ok = test(password);
                      return (
                        <div key={label} className="flex items-center gap-1.5">
                          {ok
                            ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            : <Circle className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                          <span className={cn('text-[11px]', ok ? 'text-foreground/80' : 'text-muted-foreground/60')}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div className="space-y-1.5">
              <Label htmlFor="register-confirm-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('confirmPassword')}</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="register-confirm-password"
                  type={showCfm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  autoComplete="new-password"
                  className={cn(
                    'h-11 pl-10 pr-10 transition-colors',
                    pwdMismatch && 'border-red-500/60 focus-visible:ring-red-500/20',
                    pwdMatch && 'border-emerald-500/60 focus-visible:ring-emerald-500/20',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowCfm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showCfm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <AnimatePresence>
                {pwdMismatch && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-[11px] text-red-400">
                    Passwords do not match
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <Button
              type="submit"
              className="w-full h-11 gap-2"
              disabled={!email || !password || !confirm || pwdMismatch || loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                <>
                  {t('register')}
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[hsl(var(--glass-border))]" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60">or</span>
              <div className="h-px flex-1 bg-[hsl(var(--glass-border))]" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-2.5"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading
                ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <GoogleIcon className="w-4 h-4" />}
              {t('sign_in_with_google')}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
              <Lock className="w-3 h-3" /> Your data is encrypted and never shared
            </p>
          </form>

          {/* Legal */}
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            {t('signup_legal_prefix')}{' '}
            <Link to="/regulamin" target="_blank" className="text-primary hover:underline">{t('terms')}</Link>
            {' '}{t('signup_legal_and')}{' '}
            <Link to="/polityka-prywatnosci" target="_blank" className="text-primary hover:underline">{t('privacy_policy')}</Link>
          </p>

          <p className="text-center text-sm text-muted-foreground">
            {t('haveAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              {t('haveAccount_action')}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
