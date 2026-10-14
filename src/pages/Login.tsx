import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/lib/locale';
import { Eye, EyeOff, ArrowRight, Zap, BarChart3, Shield, Loader2, ArrowLeft, Mail, KeyRound, CheckCircle2, Circle, Lock, Sparkles, Building2 } from 'lucide-react';
import { getAuthUser, loginUser, logoutAndClearSession } from '@/lib/auth';
import { signInWithGoogle } from '@/lib/googleAuth';
import { signInWithSSODomain } from '@/lib/samlAuth';
import { supabase } from '@/lib/supabase';
import { getRecaptchaToken } from '@/lib/recaptcha';
import { FloatingPathsBackground } from '@/components/ui/floating-paths';
import { Wordmark } from '@/components/Wordmark';
import { GoogleIcon } from '@/components/ui/google-icon';


const FEATURES = [
  { icon: Zap,       text: 'Visibility audit in GPT-4, Claude, Gemini' },
  { icon: BarChart3, text: 'Sentiment trend tracking over time'         },
  { icon: Shield,    text: 'Source credibility with confidence score'   },
];

const pwdRules = [
  { label: 'Min. 8 chars',    test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number',          test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special char',    test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function getPwdStrength(p: string) {
  if (!p) return 0;
  return pwdRules.filter(r => r.test(p)).length;
}

const strengthLabel = ['', 'Weak', 'Weak', 'Medium', 'Strong'];
const strengthColor = ['', 'bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-green-500'];

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir * -40, opacity: 0 }),
};

// 6 individual digit inputs
const OtpInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const focus = (i: number) => inputs.current[i]?.focus();

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const next = digits.map((d, idx) => idx === i ? '' : d).join('');
      onChange(next);
      if (i > 0) focus(i - 1);
    }
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, idx) => idx === i ? char : d).join('');
    onChange(next);
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
          id={`login-otp-digit-${i}`}
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
          className="w-11 h-14 text-center text-xl font-bold rounded-xl border border-[hsl(var(--glass-border))] bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-hidden transition-colors"
        />
      ))}
    </div>
  );
};

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/profile';

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [remember, setRemember]     = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [mode, setMode]             = useState<'login' | 'forgot' | 'otp' | 'reset' | 'forgot_sent' | 'totp' | 'sso'>(
    () => new URLSearchParams(location.search).get('mode') === 'forgot' ? 'forgot' : 'login'
  );
  const [ssoDomain, setSsoDomain]   = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState('');
  const [totpCode, setTotpCode]     = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [otpValue, setOtpValue]     = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [newPwd, setNewPwd]         = useState('');
  const [newPwdConfirm, setNewPwdConfirm] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [notice, setNotice]         = useState('');
  const [dir, setDir]               = useState(1);

  const newPwdStrength = useMemo(() => getPwdStrength(newPwd), [newPwd]);

  const switchMode = (next: typeof mode, direction = 1) => {
    setDir(direction);
    setError('');
    setMode(next);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setError('');
    setNotice('');
    try {
      const recaptchaToken = await getRecaptchaToken('reset_password');
      const res = await fetch('/.netlify/functions/send-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), recaptchaToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error sending code.');
      setOtpValue('');
      switchMode('otp', 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // Step 1: verify the 6-digit code (does not consume it yet)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpValue.replace(/\D/g, '').length < 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    setOtpLoading(true);
    setError('');
    try {
      const res = await fetch('/.netlify/functions/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), code: otpValue.replace(/\D/g, '') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code.');
      setNewPwd('');
      setNewPwdConfirm('');
      switchMode('reset', 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  // Step 2: set the new password using the verified code
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPwd !== newPwdConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setOtpLoading(true);
    setError('');
    try {
      const res = await fetch('/.netlify/functions/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), code: otpValue.replace(/\D/g, ''), newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password.');
      setEmail(resetEmail.trim());
      setNewPwd('');
      setNewPwdConfirm('');
      setOtpValue('');
      setNotice('Password changed. Sign in with your new password.');
      switchMode('login', -1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  // A session can already exist here — either this same user clicking a
  // stale bookmark/link, or (on a shared machine) someone else's session
  // left behind from before. Previously this silently navigate()'d away
  // to `from`, which meant a second person trying to log in as themselves
  // got hijacked straight into the first person's account and never even
  // saw the form. Surface it instead and let them choose.
  const [existingUser, setExistingUser] = useState<{ email: string } | null>(null);
  useEffect(() => {
    getAuthUser().then(user => { if (user?.email) setExistingUser({ email: user.email }); }).catch(() => {});
  }, []);

  // Warm the post-login route's JS chunks while the person is still typing
  // their credentials, so navigate() after a successful login doesn't have
  // to wait on a fresh chunk fetch — this is what most people land on next.
  useEffect(() => {
    import('@/components/layout/AppShell');
    import('./Dashboard');
  }, []);

  const handleSwitchAccount = async () => {
    await logoutAndClearSession();
    setExistingUser(null);
  };

  useEffect(() => {
    try {
      if (localStorage.getItem('rememberMe') === 'true') {
        setRemember(true);
        setEmail(localStorage.getItem('rememberEmail') || '');
      }
    } catch { /* ignore */ }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginUser(email, password);
      if (remember) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('rememberEmail', email);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('rememberEmail');
      }

      // Check if user has TOTP enrolled
      const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (mfaData?.nextLevel === 'aal2' && mfaData.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totpFactor = factors?.totp?.find(f => f.status === 'verified');
        if (totpFactor) {
          setTotpFactorId(totpFactor.id);
          setTotpCode('');
          setMode('totp');
          setLoading(false);
          return;
        }
      }

      navigate(from, { replace: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.message?.includes('Invalid login credentials')) {
        setError('Incorrect email or password. Please check your details and try again.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Your email is not confirmed yet. Please check your inbox for the activation link.');
      } else if (err.status === 429 || /rate limit|failed to fetch|network/i.test(err.message || '')) {
        setError('Servers are busy right now — please try again in a few seconds.');
      } else {
        setError(err.message || 'Login error. Please try again.');
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

  const handleSSOSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSsoLoading(true);
    try {
      await signInWithSSODomain(ssoDomain);
      // signInWithSSODomain redirects the browser away — this only resolves on failure.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SSO is not set up for this domain yet.');
      setSsoLoading(false);
    }
  };

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) return;
    setTotpLoading(true);
    setError('');
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: totpFactorId });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: totpFactorId, challengeId: challengeData.id, code: totpCode });
      if (verifyErr) throw verifyErr;
      navigate(from, { replace: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError('Invalid code. Check your app and try again.');
      setTotpCode('');
    } finally {
      setTotpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left panel ── */}
      <FloatingPathsBackground
        position={0.8}
        className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between p-10 border-r border-[hsl(var(--glass-border))] bg-card/30"
      >
        <Link to="/" className="flex items-center w-fit">
          <Wordmark className="text-3xl" />
        </Link>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-display leading-snug text-foreground">
              Discover how AI<br />
              <span className="text-primary">sees your brand</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">
              See exactly how ChatGPT, Claude and Gemini talk about your brand — and what to fix to get recommended more often.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm text-foreground/80 leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-muted-foreground/50">© {new Date().getFullYear()} Presora</p>
      </FloatingPathsBackground>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-hidden">
        <div className="w-full max-w-[400px]">
          {/* Top bar: mobile logo + back button */}
          <div className="flex items-center justify-between mb-6 lg:mb-4">
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

          <AnimatePresence mode="wait" custom={dir}>

            {/* ── LOGIN ── */}
            {mode === 'login' && (
              <motion.div key="login" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }} className="space-y-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary mb-2">
                    <Sparkles className="w-3.5 h-3.5" /> Welcome back
                  </span>
                  <h1 className="text-2xl font-display text-foreground">{t('login')}</h1>
                  <p className="text-sm text-muted-foreground mt-1">{t('login_subtitle')}</p>
                </div>

                {existingUser && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="text-sm bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 space-y-2"
                  >
                    <p className="text-foreground">Already signed in as <strong>{existingUser.email}</strong>.</p>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => navigate(from, { replace: true })} className="text-primary font-medium hover:underline">
                        Continue
                      </button>
                      <button type="button" onClick={handleSwitchAccount} className="text-muted-foreground hover:underline">
                        Log out &amp; use a different account
                      </button>
                    </div>
                  </motion.div>
                )}

                {notice && (
                  <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5"
                  >{notice}</motion.p>
                )}

                {error && (
                  <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5"
                  >{error}</motion.p>
                )}


                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('email')}</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" className="h-11 pl-10" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('password')}</Label>
                      <button type="button" onClick={() => switchMode('forgot', 1)} className="text-[11px] text-primary hover:underline">
                        Forgot your password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input id="login-password" type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required autoComplete="current-password" className="h-11 pl-10 pr-10" />
                      <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1} aria-label={showPwd ? 'Hide password' : 'Show password'}>
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <Checkbox id="remember" checked={remember} onCheckedChange={v => setRemember(Boolean(v))} />
                    <Label htmlFor="remember" className="mb-0! text-sm text-muted-foreground cursor-pointer">{t('remember')}</Label>
                  </div>

                  <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Signing in...
                      </span>
                    ) : <>{t('submit')}<ArrowRight className="w-3.5 h-3.5" /></>}
                  </Button>
                </form>

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
                  <Lock className="w-3 h-3" /> Secured with 256-bit encryption
                </p>

                <p className="text-center text-sm text-muted-foreground">
                  {t('noAccount')}{' '}
                  <Link to="/register" className="text-primary hover:underline font-medium">{t('noAccount_action')}</Link>
                </p>
              </motion.div>
            )}

            {/* ── FORGOT PASSWORD ── */}
            {mode === 'forgot' && (
              <motion.div key="forgot" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }} className="space-y-6">
                <button type="button" onClick={() => switchMode('login', -1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                </button>

                <div>
                  <h1 className="text-2xl font-display text-foreground">Reset password</h1>
                  <p className="text-sm text-muted-foreground mt-1">Enter your email — we'll send you a 6-digit verification code.</p>
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5"
                  >{error}</motion.p>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">E-mail</Label>
                    <Input id="forgot-email" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="jan@firma.pl" required autoComplete="email" autoFocus className="h-10" />
                  </div>

                  <Button type="submit" className="w-full h-10 gap-2" disabled={resetLoading}>
                    {resetLoading
                      ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending...</span>
                      : <><Mail className="w-3.5 h-3.5" />Send code</>}
                  </Button>
                </form>
              </motion.div>
            )}

            {/* ── COMPANY SSO (SAML 2.0) ── */}
            {mode === 'sso' && (
              <motion.div key="sso" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }} className="space-y-6">
                <button type="button" onClick={() => switchMode('login', -1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                </button>

                <div>
                  <h1 className="text-2xl font-display text-foreground">Company SSO</h1>
                  <p className="text-sm text-muted-foreground mt-1">Enter your company's domain to sign in through your organization's identity provider.</p>
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5"
                  >{error}</motion.p>
                )}

                <form onSubmit={handleSSOSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sso-domain" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company domain</Label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input id="sso-domain" type="text" value={ssoDomain} onChange={e => setSsoDomain(e.target.value)} placeholder="your-company.com" required autoFocus className="h-11 pl-10" />
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-11 gap-2" disabled={ssoLoading || !ssoDomain.trim()}>
                    {ssoLoading
                      ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Redirecting...</span>
                      : <>Continue<ArrowRight className="w-3.5 h-3.5" /></>}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  SSO is available on the Agency plan. Ask your admin to set it up, or{' '}
                  <a href="mailto:contact.presora@gmail.com" className="text-primary hover:underline">contact us</a>.
                </p>
              </motion.div>
            )}

            {/* ── OTP VERIFICATION ── */}
            {mode === 'otp' && (
              <motion.div key="otp" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }} className="space-y-6">
                <button type="button" onClick={() => switchMode('forgot', -1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Change email
                </button>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
                    <KeyRound className="w-6 h-6 text-primary" />
                  </div>
                  <h1 className="text-2xl font-display text-foreground">Enter code</h1>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    We sent a 6-digit code to<br/>
                    <span className="text-foreground font-medium">{resetEmail}</span>
                  </p>
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-center"
                  >{error}</motion.p>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <OtpInput value={otpValue} onChange={setOtpValue} />

                  <Button type="submit" className="w-full h-10 gap-2" disabled={otpLoading || otpValue.replace(/\D/g, '').length < 6}>
                    {otpLoading
                      ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Verifying...</span>
                      : <><ArrowRight className="w-3.5 h-3.5" />Next</>}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground text-center">
                  Code expires in 10 minutes ·{' '}
                  <button type="button" onClick={() => handleForgotPassword({ preventDefault: () => {} } as React.FormEvent)} className="text-primary hover:underline">
                    Resend
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── NEW PASSWORD (after code verified) ── */}
            {mode === 'reset' && (
              <motion.div key="reset" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }} className="space-y-6">
                <button type="button" onClick={() => switchMode('otp', -1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to code
                </button>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
                    <KeyRound className="w-6 h-6 text-primary" />
                  </div>
                  <h1 className="text-2xl font-display text-foreground">Set new password</h1>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Code confirmed. Enter your new account password.
                  </p>
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-center"
                  >{error}</motion.p>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-new-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New password</Label>
                    <div className="relative">
                      <Input
                        id="reset-new-password"
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPwd}
                        onChange={e => setNewPwd(e.target.value)}
                        placeholder="Minimum 8 characters"
                        autoComplete="new-password"
                        autoFocus
                        className="h-10 pr-10"
                      />
                      <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1} aria-label={showNewPwd ? 'Hide password' : 'Show password'}>
                        {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newPwd.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex gap-1 h-1">
                          {[1,2,3,4].map(i => (
                            <div key={i} className={`flex-1 rounded-full transition-colors ${i <= newPwdStrength ? strengthColor[newPwdStrength] : 'bg-muted/30'}`} />
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {pwdRules.map(({ label, test }) => {
                            const ok = test(newPwd);
                            return (
                              <div key={label} className="flex items-center gap-1.5">
                                {ok
                                  ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  : <Circle className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                                <span className={`text-[11px] ${ok ? 'text-foreground/80' : 'text-muted-foreground/60'}`}>{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-repeat-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Repeat password</Label>
                    <Input
                      id="reset-repeat-password"
                      type={showNewPwd ? 'text' : 'password'}
                      value={newPwdConfirm}
                      onChange={e => setNewPwdConfirm(e.target.value)}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                      className="h-10"
                    />
                    {newPwdConfirm.length > 0 && newPwd !== newPwdConfirm && (
                      <p className="text-[11px] text-red-400">Passwords do not match</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full h-10 gap-2" disabled={otpLoading || newPwd.length < 8 || newPwd !== newPwdConfirm}>
                    {otpLoading
                      ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</span>
                      : <><KeyRound className="w-3.5 h-3.5" />Change password</>}
                  </Button>
                </form>
              </motion.div>
            )}

            {/* ── FORGOT SENT (fallback — nie powinien się pojawić przy OTP flow) ── */}
            {mode === 'forgot_sent' && (
              <motion.div key="forgot_sent" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }} className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-display text-foreground">Check your inbox</h1>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    We sent a code to <span className="text-foreground font-medium">{resetEmail}</span>.
                  </p>
                </div>
                <Button type="button" variant="outline" className="w-full h-10 gap-2" onClick={() => switchMode('login', -1)}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                </Button>
              </motion.div>
            )}

            {/* ── TOTP 2FA challenge ── */}
            {mode === 'totp' && (
              <motion.div key="totp" custom={1} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-display text-foreground">2FA Verification</h2>
                  <p className="text-sm text-muted-foreground">Enter the code from your authenticator app</p>
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-center"
                  >{error}</motion.p>
                )}

                <form onSubmit={handleTotpVerify} className="space-y-4">
                  <Label htmlFor="login-totp-code" className="sr-only">Authenticator code</Label>
                  <Input
                    id="login-totp-code"
                    name="totp-code"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                    className="h-14 text-center text-3xl tracking-[0.4em] font-bold"
                    autoFocus
                  />
                  <Button type="submit" className="w-full h-10" disabled={totpLoading || totpCode.length < 6}>
                    {totpLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Verifying...
                      </span>
                    ) : 'Verify'}
                  </Button>
                </form>

                <Button type="button" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => { setMode('login'); setError(''); }}>
                  Back to login
                </Button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Login;
