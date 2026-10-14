import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { getGoogleRedirectUri } from '@/lib/googleAuth';
import { GradientMeshBg } from '@/components/ui/gradient-mesh-bg';
import { Wordmark } from '@/components/Wordmark';

type Status = 'loading' | 'success' | 'error';

export default function GoogleCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setErrorMsg(error === 'access_denied' ? 'Anulowano logowanie przez Google.' : error);
      setStatus('error');
      return;
    }

    if (!code) {
      setErrorMsg('Brak kodu autoryzacji. Spróbuj ponownie.');
      setStatus('error');
      return;
    }

    const exchangeCode = async () => {
      try {
        // Round-tripped via `state` (see googleAuth.ts) rather than
        // sessionStorage, which broke whenever the callback landed on a
        // different origin (www vs apex) than the one that started the flow.
        const returnedState = params.get('state') || '';
        const separator = returnedState.indexOf(':');
        const codeVerifier = separator >= 0 ? returnedState.slice(0, separator) : returnedState;
        let returnTo: string | null = null;
        if (separator >= 0) {
          try {
            const candidate = decodeURIComponent(returnedState.slice(separator + 1));
            if ((candidate === '/onboarding' || candidate.startsWith('/onboarding?')) &&
              new URL(candidate, window.location.origin).origin === window.location.origin) {
              returnTo = candidate;
            }
          } catch {
            returnTo = null;
          }
        }
        const redirectUri = getGoogleRedirectUri();

        const res = await fetch('/.netlify/functions/google-token-exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier: codeVerifier }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const { id_token } = await res.json();

        const { data: signInData, error: supaErr } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: id_token,
        });

        if (supaErr) throw supaErr;

        setStatus('success');

        // Route first-time Google sign-ups through the same onboarding wizard
        // email/password signups get (Register.tsx) — otherwise a returning
        // user's every login also gets re-checked here, so this must be
        // conditional, not unconditional like Register.tsx's redirect.
        let destination = '/dashboard';
        let hasCompletedOnboarding = false;
        if (signInData.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarded')
            .eq('id', signInData.user.id)
            .maybeSingle();
          hasCompletedOnboarding = Boolean(profile?.onboarded);
          if (!hasCompletedOnboarding) destination = returnTo || '/onboarding';
        }
        if (hasCompletedOnboarding && returnTo?.startsWith('/onboarding')) {
          const params = new URL(returnTo, window.location.origin).searchParams;
          const plan = params.get('plan');
          if (plan) {
            const checkoutParams = new URLSearchParams({ plan });
            const creditCode = params.get('credit_code');
            if (creditCode) checkoutParams.set('credit_code', creditCode);
            destination = `/pricing?${checkoutParams.toString()}`;
          }
        }
        setTimeout(() => navigate(destination), 1500);
      } catch (err) {
        console.error('Google callback error:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Błąd logowania. Spróbuj ponownie.');
        setStatus('error');
      }
    };

    exchangeCode();
  }, [navigate]);

  return (
    <GradientMeshBg className="min-h-screen flex items-center justify-center px-4" variant="mono">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-background/80 backdrop-blur-xl p-8 space-y-5">
          <Link to="/" className="inline-block">
            <Wordmark className="text-xl" />
          </Link>

          {status === 'loading' && (
            <>
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
              <div>
                <h1 className="text-xl font-display text-foreground">Logowanie przez Google…</h1>
                <p className="text-sm text-muted-foreground mt-1">Chwileczkę, weryfikujemy Twoje konto.</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </motion.div>
              <div>
                <h1 className="text-xl font-display text-foreground">Zalogowano!</h1>
                <p className="text-sm text-muted-foreground mt-1">Przekierowanie do panelu…</p>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="w-7 h-7 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-display text-foreground">Błąd logowania</h1>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{errorMsg}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button className="w-full" onClick={() => navigate('/login')}>
                  Wróć do logowania
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </GradientMeshBg>
  );
}
