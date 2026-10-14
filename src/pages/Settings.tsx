import { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TotpSetup } from '@/components/ui/totp-setup';
import { useNavigate, Link } from 'react-router-dom';
import {
  User, Bell, Shield, Trash2, Save,
  Upload, Camera, Loader2, KeyRound, Check, Mail, ArrowRight, ArrowLeft,
  Eye, EyeOff, CheckCircle2, Circle, CreditCard, Download, FileText, Volume2, Cpu, Lock,
  Play, Square as StopIcon, Gift, Copy, Users, ExternalLink,
} from 'lucide-react';
import { loadVoicePrefs, saveVoicePrefs, VoicePrefs, AVAILABLE_VOICES, fetchAvailableVoices, ElevenLabsVoice } from '@/hooks/useTTS';
import { MODEL_CATALOG, loadModelPrefs, saveModelPrefs, ModelPrefs } from '@/lib/models';
import { usePlan, tierOf, PLAN_LABELS, useSessionUser, useAvatarUrl, type SessionUser } from '@/hooks/useAccountInfo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Tab = 'account' | 'notifications' | 'security' | 'privacy' | 'billing' | 'referral';

const tabs: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'account',       label: 'Account',       icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security',      label: 'Security',      icon: KeyRound },
  { id: 'privacy',       label: 'Privacy',       icon: Shield },
  { id: 'billing',       label: 'Billing',       icon: CreditCard },
  { id: 'referral',      label: 'Refer a friend', icon: Gift },
];

// Keep in sync with FREE_PLAN_CREDIT_REWARD in netlify/functions/referral.js
const FREE_PLAN_CREDIT_REWARD_LABEL = 50;

// Stripe's own hosted customer billing portal — a no-code, shareable login
// link (the customer enters their email, Stripe verifies and shows only
// their own subscription). Given as a direct fallback next to the in-app
// Pause/Cancel actions above, so a user can always self-serve cancel even
// if manage-subscription.js is down or a webhook lag makes the in-app status
// look wrong.
const STRIPE_BILLING_PORTAL_URL = 'https://billing.stripe.com/p/login/3cIaEY72ebHT8hF8iSfnO01';

interface ReferralStatus {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  progressInCurrentMilestone: number;
  milestoneSize: number;
  rewardsClaimed: number;
  milestonesAvailable: number;
  rewardType?: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Settings edits auth user_metadata directly (avatar, display name), which
  // relies on supabase-js's onAuthStateChange to refresh the shared
  // ['session-user'] cache that AppNavbar/Dashboard read from — timing of
  // that event isn't guaranteed, so push the change into the cache
  // ourselves too instead of waiting on it (avatar/name otherwise looked
  // stale in the navbar until the next full reload).
  const patchSessionUser = (patch: Partial<SessionUser>) => {
    queryClient.setQueryData<SessionUser>(['session-user'], (prev) => prev ? { ...prev, ...patch } : prev);
  };
  // Avatar lives in the profiles-derived 'profile-flags' cache (see
  // useAvatarUrl), not on the auth session — see toSessionUser()'s comment
  // on why it's kept separate from user_metadata.
  const patchAvatarUrl = (avatarUrl: string | null) => {
    queryClient.setQueriesData<{ plan: string; isAdmin: boolean; avatarUrl: string | null }>(
      { queryKey: ['profile-flags'] },
      (prev) => prev ? { ...prev, avatarUrl } : prev
    );
  };
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    return tabs.some(t => t.id === requested) ? (requested as Tab) : 'account';
  });
  const [voicePrefs, setVoicePrefs] = useState<VoicePrefs>(loadVoicePrefs);
  const [modelPrefs, setModelPrefs] = useState<ModelPrefs>(loadModelPrefs);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[] | null>(null);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load the real ElevenLabs voice catalog once the user opens up the voice
  // picker — no point fetching it if "read aloud" stays off.
  useEffect(() => {
    if (!voicePrefs.enabled || elevenLabsVoices !== null || voicesLoading) return;
    setVoicesLoading(true);
    fetchAvailableVoices()
      .then(setElevenLabsVoices)
      .finally(() => setVoicesLoading(false));
  }, [voicePrefs.enabled, elevenLabsVoices, voicesLoading]);

  useEffect(() => () => { previewAudioRef.current?.pause(); }, []);

  const togglePreview = (voice: ElevenLabsVoice) => {
    if (previewingId === voice.id) {
      previewAudioRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    if (!voice.previewUrl) return;
    previewAudioRef.current?.pause();
    const audio = new Audio(voice.previewUrl);
    previewAudioRef.current = audio;
    audio.onended = () => setPreviewingId(null);
    audio.play();
    setPreviewingId(voice.id);
  };
  const { data: plan = 'Free' } = usePlan();
  const planTier = tierOf(plan);

  // Billing / subscription — synced from `profiles` (kept up to date by
  // stripe-webhook.js) and mutated only through manage-subscription.js,
  // which is the one place that actually calls the Stripe API.
  const [subStatus, setSubStatus] = useState<'active' | 'paused' | 'canceled' | 'inactive' | 'past_due'>('inactive');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [subHistory, setSubHistory] = useState<Array<{ status: typeof subStatus; label: string; timestamp: string }>>([]);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [subActionLoading, setSubActionLoading] = useState(false);
  const [subError, setSubError] = useState('');

  // Referral program — see netlify/functions/referral.js
  const [referral, setReferral] = useState<ReferralStatus | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralClaiming, setReferralClaiming] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [referralCopied, setReferralCopied] = useState(false);

  const fetchReferralStatus = async () => {
    setReferralLoading(true);
    setReferralError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again.');
      const res = await fetch('/.netlify/functions/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'status' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not load referral status.');
      setReferral(data);
    } catch (err) {
      setReferralError(err instanceof Error ? err.message : 'Could not load referral status.');
    } finally {
      setReferralLoading(false);
    }
  };

  const claimReferralReward = async () => {
    setReferralClaiming(true);
    setReferralError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again.');
      const res = await fetch('/.netlify/functions/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'claim' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not claim your reward.');
      setReferral(data);
    } catch (err) {
      setReferralError(err instanceof Error ? err.message : 'Could not claim your reward.');
    } finally {
      setReferralClaiming(false);
    }
  };

  const copyReferralLink = () => {
    if (!referral) return;
    navigator.clipboard.writeText(referral.referralLink);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 1800);
  };

  useEffect(() => {
    if (activeTab === 'referral' && !referral && !referralLoading) {
      fetchReferralStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [notifBrewComplete, setNotifBrewComplete] = useState(true);
  const [notifNewsletter, setNotifNewsletter] = useState(false);
  const [notifNewsletterSaving, setNotifNewsletterSaving] = useState(false);
  const [notifMarketing, setNotifMarketing] = useState(false);

  const toggleNewsletter = async (next: boolean) => {
    const previous = notifNewsletter;
    setNotifNewsletter(next); // optimistic
    setNotifNewsletterSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('no session');
      const res = await fetch('/.netlify/functions/newsletter-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ subscribed: next }),
      });
      if (!res.ok) throw new Error('request failed');
    } catch {
      setNotifNewsletter(previous); // revert on failure
    } finally {
      setNotifNewsletterSaving(false);
    }
  };

  // Withdrawal form
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [withdrawalService, setWithdrawalService] = useState('');
  const [withdrawalDate, setWithdrawalDate] = useState('');
  const [withdrawalStatus, setWithdrawalStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Delete account
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deleteMethod, setDeleteMethod] = useState<'password' | '2fa'>('password');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteTotpCode, setDeleteTotpCode] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'done'>('idle');
  const [deleteError, setDeleteError] = useState('');

  const handleWithdrawal = async () => {
    if (!withdrawalService.trim() || !withdrawalDate) return;
    setWithdrawalStatus('sending');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email ?? email;
      const body = `FORMULARZ ODSTAPIENIA OD UMOWY\n\nAdresat: Patryk Rybacki\nE-mail: contact.presora@gmail.com\n\nJa, niniejszym informuje o moim odstąpieniu od umowy o swiadczenie nastepujacej uslugi:\n${withdrawalService}\n\nData zawarcia umowy: ${withdrawalDate}\n\nImię i nazwisko / e-mail konsumenta: ${userEmail}\n\nData złożenia oswiadczenia: ${new Date().toLocaleDateString('pl-PL')}`;
      const res = await fetch('/.netlify/functions/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userEmail,
          email: userEmail,
          subject: 'Odstapienie od umowy',
          message: body,
        }),
      });
      if (!res.ok) throw new Error('send failed');
      setWithdrawalStatus('sent');
    } catch {
      setWithdrawalStatus('error');
    }
  };

  const [userId, setUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security tab — change password via OTP
  const [pwdStep, setPwdStep] = useState<'idle' | 'sending' | 'otp' | 'newpwd' | 'done'>('idle');
  const [pwdOtp, setPwdOtp] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwdNew, setShowPwdNew] = useState(false);

  const pwdRules = [
    { label: 'Min. 8 chars',    test: (p: string) => p.length >= 8 },
    { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Number',          test: (p: string) => /[0-9]/.test(p) },
    { label: 'Special char',    test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ];

  const pwdStrength = useMemo(() => {
    if (!pwdNew) return 0;
    return pwdRules.filter(r => r.test(pwdNew)).length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwdNew]);

  const pwdStrengthLabel = ['', 'Weak', 'Weak', 'Medium', 'Strong'][pwdStrength];
  const pwdStrengthColor = ['', 'bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-green-500'][pwdStrength];

  // Security tab — change email
  const [emailStep, setEmailStep] = useState<'idle' | 'input' | 'sent'>('idle');
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const { data: sessionUser, isLoading: userLoading } = useSessionUser();
  const { data: dbAvatarUrl } = useAvatarUrl();

  useEffect(() => {
    const storedHist = localStorage.getItem('subscriptionHistory');
    if (storedHist) {
      try { setSubHistory(JSON.parse(storedHist)); } catch { /* noop */ }
    }
  }, []);

  useEffect(() => {
    setAvatarUrl(dbAvatarUrl ?? null);
  }, [dbAvatarUrl]);

  useEffect(() => {
    if (userLoading) return;
    if (!sessionUser?.id) { navigate('/login'); return; }
    const uid = sessionUser.id;
    setUserId(uid);
    setEmail(sessionUser.email ?? '');
    setDisplayName(sessionUser.name ?? '');

    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, current_period_end')
        .eq('id', uid)
        .maybeSingle();
      if (profile?.subscription_status) {
        setSubStatus(profile.subscription_status as typeof subStatus);
      }
      setCurrentPeriodEnd(profile?.current_period_end ?? null);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch('/.netlify/functions/newsletter-preference', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => { if (data) setNotifNewsletter(data.subscribed); })
          .catch(() => { /* leave default */ });
      }
    })();
  }, [navigate, sessionUser, userLoading]);

  const SUB_DOT = {
    active: 'bg-emerald-400 ring-emerald-400/30',
    paused: 'bg-amber-400 ring-amber-400/30',
    canceled: 'bg-red-500 ring-red-500/30',
    inactive: 'bg-muted-foreground/40 ring-muted-foreground/10',
    past_due: 'bg-red-500 ring-red-500/30',
  } as const;
  const SUB_STATUS_LABEL = {
    active: 'Active', paused: 'Paused', canceled: 'Cancels at period end',
    inactive: 'No active subscription', past_due: 'Payment failed — update your card',
  } as const;

  const updateSub = async (action: 'cancel' | 'resume' | 'pause' | 'unpause') => {
    setSubActionLoading(true);
    setSubError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/.netlify/functions/manage-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubError(data?.error || 'Could not update your subscription.');
        return;
      }

      const nextStatus: typeof subStatus = data.paused ? 'paused' : data.cancel_at_period_end ? 'canceled' : data.status;
      setSubStatus(nextStatus);
      setCurrentPeriodEnd(data.current_period_end ?? null);

      const label = SUB_STATUS_LABEL[nextStatus] ?? nextStatus;
      const next = [{ status: nextStatus, label, timestamp: new Date().toISOString() }, ...subHistory].slice(0, 20);
      setSubHistory(next);
      localStorage.setItem('subscriptionHistory', JSON.stringify(next));
    } catch {
      setSubError('Connection error. Please try again.');
    } finally {
      setSubActionLoading(false);
    }
  };

  const downloadHistory = () => {
    if (!subHistory.length) return;
    const isJson = exportFormat === 'json';
    const content = isJson
      ? JSON.stringify(subHistory, null, 2)
      : [['Date', 'Status', 'Description'], ...subHistory.map(i => [
          new Date(i.timestamp).toLocaleString(),
          i.status,
          i.label,
        ])].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: isJson ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `billing-history.${exportFormat}` }).click();
    URL.revokeObjectURL(url);
  };

  const initials = email ? email[0].toUpperCase() : '?';

  const handleAvatarFile = async (file: File) => {
    if (!userId) return;
    setUploadError(null);

    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be under 2MB');
      return;
    }

    setUploading(true);
    const blobUrl = URL.createObjectURL(file);
    setAvatarUrl(blobUrl);

    try {
      const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_EXTS.includes(ext)) {
        throw new Error('Please choose an image file');
      }
      const storagePath = `${userId}/avatar.${ext}`;

      const { error: storageError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, file, { upsert: true, contentType: file.type });
      if (storageError) throw storageError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(storagePath);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);

      URL.revokeObjectURL(blobUrl);
      setAvatarUrl(publicUrl);
      patchAvatarUrl(publicUrl);
    } catch (err) {
      console.error('Avatar upload error:', err);
      URL.revokeObjectURL(blobUrl);
      setAvatarUrl(null);
      setUploadError(
        err?.message?.includes('Bucket not found')
          ? 'Bucket "avatars" does not exist in Supabase Storage. Run the SQL migration.'
          : err?.message?.includes('row-level security')
          ? 'No write permission. Check the RLS policies for the "avatars" bucket.'
          : 'Upload failed, please try again'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!userId) return;
    setUploading(true);
    try {
      await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
      setAvatarUrl(null);
      patchAvatarUrl(null);
    } catch (err) {
      console.error('Avatar remove error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } });
      if (error) throw error;
      await supabase.auth.refreshSession();
      await supabase.from('profiles').update({ full_name: displayName }).eq('id', userId);
      patchSessionUser({ name: displayName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSendPwdOtp = async () => {
    if (!email) return;
    setPwdLoading(true);
    setPwdError('');
    try {
      const res = await fetch('/.netlify/functions/send-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error sending code.');
      setPwdOtp('');
      setPwdStep('otp');
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Error sending code.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleVerifyPwdOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdOtp.replace(/\D/g, '').length < 6) { setPwdError('Please enter the full 6-digit code.'); return; }
    setPwdLoading(true);
    setPwdError('');
    try {
      const res = await fetch('/.netlify/functions/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: pwdOtp.replace(/\D/g, '') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code.');
      setPwdNew('');
      setPwdConfirm('');
      setPwdStep('newpwd');
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Invalid code.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdNew.length < 8) { setPwdError('Password must be at least 8 characters.'); return; }
    if (pwdNew !== pwdConfirm) { setPwdError('Passwords do not match.'); return; }
    setPwdLoading(true);
    setPwdError('');
    try {
      const res = await fetch('/.netlify/functions/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: pwdOtp.replace(/\D/g, ''), newPassword: pwdNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password.');
      setPwdStep('done');
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() });
      if (error) throw error;
      setEmailStep('sent');
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to change email address.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleDataExport = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: analyses } = await supabase.from('analyses').select('*').eq('user_id', user.id);
    const blob = new Blob([JSON.stringify({ user: { id: user.id, email: user.email }, analyses: analyses ?? [] }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'presora-data.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    setDeleteStatus('deleting');
    setDeleteError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      if (deleteMethod === 'password') {
        if (!deletePassword) { setDeleteError('Enter password'); setDeleteStatus('idle'); return; }
        const { error } = await supabase.auth.signInWithPassword({ email: user.email!, password: deletePassword });
        if (error) { setDeleteError('Incorrect password'); setDeleteStatus('idle'); return; }
      } else {
        if (deleteTotpCode.length !== 6) { setDeleteError('Enter 6-digit 2FA code'); setDeleteStatus('idle'); return; }
        const { error } = await supabase.auth.verifyOtp({ email: user.email!, token: deleteTotpCode, type: 'totp' });
        if (error) { setDeleteError('Invalid 2FA code'); setDeleteStatus('idle'); return; }
      }

      await supabase.from('profiles').delete().eq('id', user.id);
      await supabase.from('analyses').delete().eq('user_id', user.id);
      await supabase.auth.signOut();
      setDeleteStatus('done');
      setTimeout(() => navigate('/'), 1500);
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'An error occurred');
      setDeleteStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Settings</h1>
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Left tab sidebar — full-width stacked list on mobile, fixed side column from md up */}
          <aside className="w-full md:w-48 md:shrink-0">
            <nav className="flex flex-row md:flex-col gap-0.5 overflow-x-auto md:overflow-visible -mx-4 px-5 md:mx-0 md:px-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 shrink-0 md:w-full px-3 py-2 rounded-lg text-sm transition-all duration-150 text-left active:scale-[0.98] whitespace-nowrap',
                    activeTab === tab.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <tab.icon className="w-4 h-4 shrink-0" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="rounded-xl border border-[hsl(var(--glass-border))] bg-card p-4 sm:p-6 space-y-6">

              {/* ACCOUNT */}
              {activeTab === 'account' && (
                <>
                  {/* Avatar uploader */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleAvatarFile(file);
                    }}
                    className={cn(
                      'flex items-center gap-5 p-4 rounded-xl border border-dashed transition-colors',
                      dragOver ? 'border-primary bg-primary/5' : 'border-[hsl(var(--glass-border))] bg-muted/20'
                    )}
                  >
                    <div className="relative group">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="relative block transition-transform duration-150 active:scale-[0.96]"
                        aria-label="Change photo"
                      >
                        <Avatar className="h-20 w-20 ring-2 ring-primary/30">
                          <AvatarImage src={avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xl font-semibold bg-primary text-primary-foreground">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                        </div>
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dragOver ? 'Drop the image to upload' : 'Drag a photo here or click to upload (max 2MB)'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          {avatarUrl ? 'Change photo' : 'Upload photo'}
                        </Button>
                        {avatarUrl && (
                          <Button type="button" size="sm" variant="ghost" disabled={uploading} onClick={handleAvatarRemove} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Remove
                          </Button>
                        )}
                      </div>
                      {uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}
                    </div>

                    <input
                      id="settings-avatar-upload"
                      name="avatar"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAvatarFile(file);
                        e.target.value = '';
                      }}
                    />
                  </div>

                  <div className="h-px bg-border" />

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="settings-display-name" className="text-sm font-medium text-foreground block mb-1.5">Display name</label>
                      <Input id="settings-display-name" name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                    </div>
                    <div>
                      <label htmlFor="settings-email" className="text-sm font-medium text-foreground block mb-1.5">Email</label>
                      <Input id="settings-email" name="email" value={email} disabled className="opacity-60" />
                      <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here</p>
                    </div>
                  </div>

                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saved ? '✓ Saved' : saving ? 'Saving…' : (
                      <><Save className="w-3.5 h-3.5 mr-1.5" />Save changes</>
                    )}
                  </Button>

                  {/* Delete account */}
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm font-medium text-foreground mb-1">Delete account</p>
                    <p className="text-xs text-muted-foreground mb-3">This operation is irreversible. All data will be permanently deleted.</p>
                    <button
                      onClick={() => setShowDeleteForm(true)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-all duration-150 active:scale-[0.98]"
                    >
                      <Trash2 className="inline w-3.5 h-3.5 mr-1.5" />
                      Delete account
                    </button>
                  </div>

                  {/* Delete account dialog */}
                  <Dialog open={showDeleteForm} onOpenChange={(open) => {
                    if (!open) { setShowDeleteForm(false); setDeletePassword(''); setDeleteTotpCode(''); setDeleteError(''); setDeleteStatus('idle'); }
                  }}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                          <Trash2 className="w-4 h-4" /> Delete account
                        </DialogTitle>
                        <DialogDescription>
                          This operation is irreversible. All your data will be permanently deleted.
                        </DialogDescription>
                      </DialogHeader>

                      {deleteStatus === 'done' ? (
                        <p className="text-sm text-muted-foreground py-2">Account deleted.</p>
                      ) : (
                        <div className="space-y-4 py-2">
                          <div className="flex gap-2 text-xs">
                            <button
                              onClick={() => setDeleteMethod('password')}
                              className={cn('px-3 py-1.5 rounded border transition-all duration-150 active:scale-[0.98]', deleteMethod === 'password' ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'border-border text-muted-foreground hover:bg-accent')}
                            >
                              Password
                            </button>
                            <button
                              onClick={() => setDeleteMethod('2fa')}
                              className={cn('px-3 py-1.5 rounded border transition-all duration-150 active:scale-[0.98]', deleteMethod === '2fa' ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'border-border text-muted-foreground hover:bg-accent')}
                            >
                              2FA code (I don't remember my password)
                            </button>
                          </div>

                          {deleteMethod === 'password' ? (
                            <Input id="delete-account-password" name="deletePassword" type="password" placeholder="Enter password" aria-label="Password" autoComplete="current-password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
                          ) : (
                            <Input id="delete-account-totp" name="deleteTotpCode" type="text" placeholder="Code from 2FA app (6 digits)" aria-label="2FA code" maxLength={6} value={deleteTotpCode} onChange={e => setDeleteTotpCode(e.target.value.replace(/\D/g, ''))} />
                          )}

                          {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}

                          <div className="flex gap-2 justify-end pt-2">
                            <button
                              onClick={() => { setShowDeleteForm(false); setDeletePassword(''); setDeleteTotpCode(''); setDeleteError(''); }}
                              className="px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-accent transition-all duration-150 active:scale-[0.98]"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={deleteStatus === 'deleting'}
                              onClick={handleDeleteAccount}
                              className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-white hover:bg-destructive/90 transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
                            >
                              {deleteStatus === 'deleting' ? 'Deleting...' : 'Confirm and delete'}
                            </button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                  {/* AI Voice */}
                  <div className="h-px bg-border" />
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">
                    <Volume2 className="inline w-4 h-4 mr-1.5 text-primary" />
                    AI Voice (report reading)
                  </label>
                  <p className="text-xs text-muted-foreground mb-4">
                    Play the report aloud after analysis completes. Requires an ElevenLabs key in the Netlify panel.
                  </p>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20 mb-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Enable read aloud</p>
                      <p className="text-xs text-muted-foreground">A button will appear in the analysis report</p>
                    </div>
                    <button
                      onClick={() => {
                        const p = { ...voicePrefs, enabled: !voicePrefs.enabled };
                        setVoicePrefs(p);
                        saveVoicePrefs(p);
                      }}
                      className={cn('relative w-10 h-6 rounded-full transition-colors active:scale-95', voicePrefs.enabled ? 'bg-primary' : 'bg-muted')}
                    >
                      <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200', voicePrefs.enabled ? 'left-5' : 'left-1')} />
                    </button>
                  </div>
                  {voicePrefs.enabled && (
                    <>
                      {voicesLoading && !elevenLabsVoices ? (
                        <div className="grid grid-cols-2 gap-2">
                          {[0, 1, 2, 3].map(i => (
                            <div key={i} className="h-14 rounded-xl border border-input bg-muted/30 animate-pulse" />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {(elevenLabsVoices && elevenLabsVoices.length > 0 ? elevenLabsVoices : AVAILABLE_VOICES).map(v => {
                            const hasPreview = 'previewUrl' in v && !!v.previewUrl;
                            const isPreviewing = previewingId === v.id;
                            return (
                              <div
                                key={v.id}
                                className={cn(
                                  'flex items-center gap-1.5 p-3 rounded-xl border transition-all duration-150',
                                  voicePrefs.voiceId === v.id
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'border-input text-muted-foreground hover:text-foreground hover:bg-accent'
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const p = { ...voicePrefs, voiceId: v.id };
                                    setVoicePrefs(p);
                                    saveVoicePrefs(p);
                                  }}
                                  className="flex-1 min-w-0 flex flex-col items-start text-left active:scale-[0.98] transition-transform"
                                >
                                  <span className="text-sm font-medium truncate w-full">{v.name}</span>
                                  <span className="text-[11px] opacity-70 truncate w-full">
                                    {'description' in v ? v.description : ('category' in v ? v.category ?? 'ElevenLabs' : 'ElevenLabs')}
                                  </span>
                                </button>
                                {hasPreview && (
                                  <button
                                    type="button"
                                    onClick={() => togglePreview(v as ElevenLabsVoice)}
                                    aria-label={isPreviewing ? 'Stop preview' : `Preview ${v.name}`}
                                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-current/20 hover:bg-current/10 transition-colors active:scale-95"
                                  >
                                    {isPreviewing ? <StopIcon className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {elevenLabsVoices && elevenLabsVoices.length === 0 && !voicesLoading && (
                        <p className="text-[11px] text-muted-foreground/70 mt-2">
                          Couldn't load your ElevenLabs voice catalog — showing the default set instead.
                        </p>
                      )}
                    </>
                  )}
                  </div>

                  {/* AI Models */}
                  <div className="h-px bg-border" />
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">
                      <Cpu className="inline w-4 h-4 mr-1.5 text-primary" />
                      AI models scanned
                    </label>
                    <p className="text-xs text-muted-foreground mb-4">
                      Choose which AI models to query on each scan. Your plan ({plan}) allows up to{' '}
                      {MODEL_CATALOG.filter(m => m.tier <= planTier).length} of {MODEL_CATALOG.length}.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {MODEL_CATALOG.map(m => {
                        const unlocked = m.tier <= planTier;
                        const checked = modelPrefs.selected.includes(m.id);
                        if (!unlocked) {
                          return (
                            <Link
                              key={m.id}
                              to="/pricing"
                              className="flex items-center justify-between gap-2 p-3 rounded-xl border border-[hsl(var(--glass-border))] text-muted-foreground opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <span className="text-sm font-medium">{m.label}</span>
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                            </Link>
                          );
                        }
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              const next = checked
                                ? modelPrefs.selected.filter(id => id !== m.id)
                                : [...modelPrefs.selected, m.id];
                              if (next.length === 0) return; // keep at least one model selected
                              const p = { selected: next };
                              setModelPrefs(p);
                              saveModelPrefs(p);
                            }}
                            className={cn(
                              'flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition-all duration-150 active:scale-[0.98]',
                              checked
                                ? 'bg-primary/10 border-primary text-primary'
                                : 'border-input text-muted-foreground hover:text-foreground hover:bg-accent'
                            )}
                          >
                            <span className="text-sm font-medium">{m.label}</span>
                            <span className={cn('w-4 h-4 rounded-md border flex items-center justify-center shrink-0', checked ? 'bg-primary border-primary' : 'border-input')}>
                              {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  {[
                    { label: 'Scan complete', desc: 'Get notified when your brand analysis is ready', value: notifBrewComplete, set: setNotifBrewComplete, saving: false },
                    { label: 'Newsletter', desc: 'Receive our weekly digest — turn off to unsubscribe', value: notifNewsletter, set: toggleNewsletter, saving: notifNewsletterSaving },
                    { label: 'Product updates', desc: 'News about new features and offers', value: notifMarketing, set: setNotifMarketing, saving: false },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4 p-4 rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => item.set(!item.value)}
                        disabled={item.saving}
                        className={cn('relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed', item.value ? 'bg-primary' : 'bg-muted')}
                      >
                        <span className={cn('pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform', item.value ? 'translate-x-4' : 'translate-x-0')} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* SECURITY */}
              {activeTab === 'security' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20 space-y-3">
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Two-factor authentication (2FA)</p>
                        <p className="text-xs text-muted-foreground">Google Authenticator, Authy and others</p>
                      </div>
                    </div>
                    <TotpSetup />
                  </div>

                  <div className="p-4 rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <KeyRound className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Change password</p>
                        <p className="text-xs text-muted-foreground">
                          {pwdStep === 'idle' ? <>We'll send a verification code to <strong>{email}</strong></> : null}
                          {pwdStep === 'otp' ? 'Enter the code from your email' : null}
                          {pwdStep === 'newpwd' ? 'Code confirmed — set your new password' : null}
                          {pwdStep === 'done' ? 'Password has been changed' : null}
                        </p>
                      </div>
                    </div>

                    {pwdError && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{pwdError}</p>
                    )}

                    {pwdStep === 'idle' && (
                      <Button size="sm" variant="outline" className="w-full" disabled={pwdLoading} onClick={handleSendPwdOtp}>
                        {pwdLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1.5" />}
                        Send verification code
                      </Button>
                    )}

                    {pwdStep === 'otp' && (
                      <form onSubmit={handleVerifyPwdOtp} className="space-y-3">
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">6-digit code from email</p>
                          <Input
                            id="settings-pwd-otp"
                            name="otp"
                            value={pwdOtp}
                            onChange={e => setPwdOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            aria-label="6-digit verification code"
                            inputMode="numeric"
                            maxLength={6}
                            className="h-10 text-center text-xl tracking-widest font-bold"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="ghost" onClick={() => { setPwdStep('idle'); setPwdError(''); }}>
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </Button>
                          <Button type="submit" size="sm" className="flex-1" disabled={pwdLoading || pwdOtp.length < 6}>
                            {pwdLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5 mr-1.5" />}
                            Next
                          </Button>
                        </div>
                      </form>
                    )}

                    {pwdStep === 'newpwd' && (
                      <form onSubmit={handleSetNewPassword} className="space-y-3">
                        <div className="relative">
                          <Input
                            id="settings-pwd-new"
                            name="newPassword"
                            type={showPwdNew ? 'text' : 'password'}
                            value={pwdNew}
                            onChange={e => setPwdNew(e.target.value)}
                            placeholder="New password"
                            aria-label="New password"
                            autoComplete="new-password"
                            className="h-10 pr-10"
                            autoFocus
                          />
                          <button type="button" onClick={() => setShowPwdNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                            {showPwdNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {pwdNew.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex gap-1 h-1">
                              {[1, 2, 3, 4].map(i => (
                                <div key={i} className={`flex-1 rounded-full transition-colors ${i <= pwdStrength ? pwdStrengthColor : 'bg-muted/40'}`} />
                              ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{pwdStrengthLabel}</p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5">
                              {pwdRules.map(({ label, test }) => {
                                const ok = test(pwdNew);
                                return (
                                  <div key={label} className="flex items-center gap-1.5">
                                    {ok ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> : <Circle className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                                    <span className={`text-[11px] ${ok ? 'text-foreground/80' : 'text-muted-foreground/60'}`}>{label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <Input id="settings-pwd-confirm" name="confirmPassword" type={showPwdNew ? 'text' : 'password'} value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)} placeholder="Repeat password" aria-label="Repeat new password" autoComplete="new-password" className="h-10" />
                        {pwdConfirm.length > 0 && pwdNew !== pwdConfirm && (
                          <p className="text-[11px] text-red-400">Passwords do not match</p>
                        )}
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="ghost" onClick={() => { setPwdStep('otp'); setPwdError(''); }}>
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </Button>
                          <Button type="submit" size="sm" className="flex-1" disabled={pwdLoading || pwdNew.length < 8 || pwdNew !== pwdConfirm}>
                            {pwdLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 mr-1.5" />}
                            Change password
                          </Button>
                        </div>
                      </form>
                    )}

                    {pwdStep === 'done' && (
                      <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 rounded-lg px-3 py-2">
                        <Check className="w-4 h-4 shrink-0" />
                        Password changed successfully.
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Change email address</p>
                        <p className="text-xs text-muted-foreground">Current: <strong>{email}</strong></p>
                      </div>
                    </div>

                    {emailError && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{emailError}</p>
                    )}

                    {emailStep === 'idle' && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => { setEmailStep('input'); setEmailError(''); setNewEmail(''); }}>
                        <Mail className="w-3.5 h-3.5 mr-1.5" />
                        Change email
                      </Button>
                    )}

                    {emailStep === 'input' && (
                      <form onSubmit={handleChangeEmail} className="space-y-3">
                        <Input id="settings-new-email" name="newEmail" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" aria-label="New email address" autoComplete="email" className="h-10" autoFocus />
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="ghost" onClick={() => { setEmailStep('idle'); setEmailError(''); }}>
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </Button>
                          <Button type="submit" size="sm" className="flex-1" disabled={emailLoading || !newEmail.trim()}>
                            {emailLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5 mr-1.5" />}
                            Send confirmation
                          </Button>
                        </div>
                      </form>
                    )}

                    {emailStep === 'sent' && (
                      <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 rounded-lg px-3 py-2">
                        <Check className="w-4 h-4 shrink-0" />
                        Confirmation link sent to <strong className="ml-1">{newEmail}</strong>. Click it to confirm the change.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PRIVACY */}
              {activeTab === 'privacy' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">We respect your data. Read our policies below.</p>
                  <div className="flex flex-col gap-2">
                    <a href="/privacy" target="_blank" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                      <Shield className="w-4 h-4" /> Privacy Policy
                    </a>
                    <a href="/terms" target="_blank" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                      <Shield className="w-4 h-4" /> Terms of Service
                    </a>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="p-4 rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20">
                    <p className="text-sm font-medium text-foreground mb-1">Export your data</p>
                    <p className="text-xs text-muted-foreground mb-3">Download all your brand analyses as JSON</p>
                    <Button variant="outline" size="sm" onClick={handleDataExport}>Export data</Button>
                  </div>
                </div>
              )}

              {/* BILLING */}
              {activeTab === 'billing' && (
                <div className="space-y-5">
                  {subError && (
                    <p className="text-sm text-destructive">{subError}</p>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[hsl(var(--glass-border))] bg-card/40">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-2.5 w-2.5 rounded-full ring-2 ${SUB_DOT[subStatus]} animate-pulse`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {PLAN_LABELS[plan] ?? plan} <span className="text-muted-foreground font-normal">· {SUB_STATUS_LABEL[subStatus]}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {subStatus === 'canceled' && currentPeriodEnd
                            ? `Access continues until ${new Date(currentPeriodEnd).toLocaleDateString()}.`
                            : 'Pause or cancel anytime — no contracts.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {subStatus === 'active' && (
                        <>
                          <Button size="sm" variant="outline" disabled={subActionLoading} onClick={() => updateSub('pause')}>Pause</Button>
                          <Button size="sm" variant="outline" disabled={subActionLoading} onClick={() => updateSub('cancel')}>Cancel</Button>
                        </>
                      )}
                      {subStatus === 'past_due' && (
                        <Button size="sm" variant="outline" disabled={subActionLoading} onClick={() => updateSub('cancel')}>Cancel</Button>
                      )}
                      {subStatus === 'paused' && (
                        <>
                          <Button size="sm" disabled={subActionLoading} onClick={() => updateSub('unpause')}>Resume</Button>
                          <Button size="sm" variant="outline" disabled={subActionLoading} onClick={() => updateSub('cancel')}>Cancel</Button>
                        </>
                      )}
                      {subStatus === 'canceled' && (
                        <Button size="sm" disabled={subActionLoading} onClick={() => updateSub('resume')}>Resume</Button>
                      )}
                      {subStatus === 'inactive' && (
                        <Button size="sm" onClick={() => navigate('/pricing')}>View plans</Button>
                      )}
                    </div>
                  </div>

                  <a
                    href={STRIPE_BILLING_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 p-4 rounded-xl border border-[hsl(var(--glass-border))] bg-card/40 hover:bg-card/70 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Manage billing on Stripe</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Update your card, download invoices, or cancel directly with Stripe — no login needed here.
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                  </a>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-semibold">Recent subscription activity</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">
                        Changes made from this device — not a full invoice history. Every payment sends a VAT invoice to your email.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={exportFormat}
                        onChange={e => setExportFormat(e.target.value as 'csv' | 'json')}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                      </select>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={downloadHistory}>
                        <Download className="w-3 h-3" /> Download
                      </Button>
                    </div>
                  </div>

                  {subHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity recorded on this device yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {subHistory.map((item, i) => (
                        <div key={item.timestamp + i} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20 text-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ring-2 ${SUB_DOT[item.status]}`} />
                            <span className="font-medium text-foreground truncate">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{SUB_STATUS_LABEL[item.status]}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-[hsl(var(--glass-border))] pt-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Withdrawal from contract</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            As a consumer you have the right to withdraw from the contract within 14 days of conclusion, without giving a reason.
                          </p>
                        </div>
                      </div>
                      {withdrawalStatus !== 'sent' && (
                        <Button size="sm" variant="outline" className="shrink-0" onClick={() => setShowWithdrawal(v => !v)}>
                          {showWithdrawal ? 'Cancel' : 'Submit declaration'}
                        </Button>
                      )}
                    </div>

                    {showWithdrawal && withdrawalStatus !== 'sent' && (
                      <div className="space-y-3 p-4 rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Fill in the form below. The declaration will be sent to <strong>contact.presora@gmail.com</strong>.
                        </p>
                        <div className="space-y-1.5">
                          <label htmlFor="withdrawal-service" className="text-xs text-muted-foreground">Name of service you are withdrawing from *</label>
                          <Input id="withdrawal-service" name="withdrawalService" value={withdrawalService} onChange={e => setWithdrawalService(e.target.value)} placeholder="e.g. Solo / Growth / Enterprise subscription" className="text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="withdrawal-date" className="text-xs text-muted-foreground">Contract date *</label>
                          <Input id="withdrawal-date" name="withdrawalDate" type="date" value={withdrawalDate} onChange={e => setWithdrawalDate(e.target.value)} className="text-sm" />
                        </div>
                        {withdrawalStatus === 'error' && (
                          <p className="text-xs text-destructive">An error occurred while sending. Try again or write directly to <strong>contact.presora@gmail.com</strong>.</p>
                        )}
                        <Button size="sm" onClick={handleWithdrawal} disabled={!withdrawalService.trim() || !withdrawalDate || withdrawalStatus === 'sending'} className="w-full gap-1.5">
                          {withdrawalStatus === 'sending'
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                            : <><Mail className="w-3.5 h-3.5" /> Send withdrawal declaration</>}
                        </Button>
                      </div>
                    )}

                    {withdrawalStatus === 'sent' && (
                      <div className="flex flex-col items-center gap-2 py-5 text-center p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                        <p className="text-sm font-medium text-foreground">Declaration sent</p>
                        <p className="text-xs text-muted-foreground max-w-xs">Confirmation has been sent to your email address. We will respond within 14 days.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'referral' && (
                <div className="space-y-5">
                  {referralLoading && !referral ? (
                    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                  ) : referral ? (
                    <>
                      <div className="p-4 rounded-xl border border-[hsl(var(--glass-border))] bg-card/40">
                        <p className="text-sm font-medium text-foreground mb-1">Your referral link</p>
                        <p className="text-xs text-muted-foreground mb-3">
                          Share it — every friend who signs up counts toward your reward. Every {referral.milestoneSize} referrals unlocks 20% off your next invoice (or {FREE_PLAN_CREDIT_REWARD_LABEL} bonus analyses if you're on the free plan).
                        </p>
                        <div className="flex items-center gap-2">
                          <Input id="referral-link" name="referralLink" readOnly value={referral.referralLink} aria-label="Your referral link" className="text-xs font-mono" />
                          <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={copyReferralLink}>
                            {referralCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {referralCopied ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-[hsl(var(--glass-border))] bg-card/40">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            <p className="text-sm font-medium text-foreground">{referral.totalReferrals} friend{referral.totalReferrals === 1 ? '' : 's'} referred</p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {referral.progressInCurrentMilestone}/{referral.milestoneSize} to next reward
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${(referral.progressInCurrentMilestone / referral.milestoneSize) * 100}%` }}
                          />
                        </div>
                      </div>

                      {referral.milestonesAvailable > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-primary/30 bg-primary/6">
                          <div>
                            <p className="text-sm font-medium text-foreground">Reward ready to claim</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              You've unlocked {referral.milestonesAvailable} reward{referral.milestonesAvailable === 1 ? '' : 's'}.
                            </p>
                          </div>
                          <Button size="sm" disabled={referralClaiming} onClick={claimReferralReward} className="gap-1.5 shrink-0">
                            {referralClaiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                            Claim reward
                          </Button>
                        </div>
                      )}

                      {referral.rewardsClaimed > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {referral.rewardsClaimed} reward{referral.rewardsClaimed === 1 ? '' : 's'} claimed so far.
                        </p>
                      )}
                    </>
                  ) : null}
                  {referralError && <p className="text-sm text-destructive">{referralError}</p>}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
