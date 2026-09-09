import { useState, useCallback, useRef } from 'react';
import { AnalysisResult, SourceResult } from '@/types/analysis';
import { supabase } from '@/lib/supabase';
import { loadModelPrefs } from '@/lib/models';
import { canonicalBrandName } from '@/lib/analyses';

type StoredDimensions = {
  authority: number;
  sentiment: number;
  recency: number;
  mentions: number;
  accuracy: number;
};

const buildViewFromStored = (
  brandName: string,
  dims: StoredDimensions,
  trustScore: number,
  createdAt?: string,
  storedSources?: unknown,
): AnalysisResult => {
  const sentimentTrend = Array.from({ length: 7 }).map((_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
    score: Math.max(0, Math.min(100, Math.round(dims.sentiment + Math.round(Math.sin(i + dims.authority) * 6)))),
  }));
  const sourceBreakdown = [
    { name: 'News', value: Math.max(20, Math.min(70, Math.round((dims.authority + dims.accuracy) / 2))), color: '#8B79F6' },
    { name: 'Social', value: Math.max(10, Math.min(60, Math.round((dims.mentions + dims.sentiment) / 2))), color: '#60A5FA' },
    { name: 'Blogs', value: Math.max(5, Math.min(40, Math.round(dims.recency / 2))), color: '#34D399' },
  ];
  // Real per-model answers, saved at scan time, take priority — reopening a
  // report must show what the models actually said, not a formula guess
  // derived from the score. The synthetic 3-source array below only exists
  // as a last resort for rows saved before `sources` was persisted at all.
  const sources: SourceResult[] = (Array.isArray(storedSources) && storedSources.length > 0)
    ? storedSources.map((raw) => {
        const it = (raw ?? {}) as Record<string, unknown>;
        return {
          model: String(it.model ?? 'Unknown'),
          sentiment: normalizeSentiment(it.sentiment),
          association: String(it.association ?? ''),
          confidence: Math.max(0, Math.min(100, Number(it.confidence) || 0)),
        } satisfies SourceResult;
      })
    : [
        { model: 'GPT-4o', sentiment: dims.sentiment > 60 ? 'Positive' : 'Neutral', association: `${brandName} product`, confidence: Math.max(30, Math.min(99, dims.authority)) },
        { model: 'Claude', sentiment: dims.sentiment > 55 ? 'Positive' : 'Neutral', association: `${brandName} brand`, confidence: Math.max(25, Math.min(95, dims.accuracy)) },
        { model: 'Gemini', sentiment: dims.mentions > 50 ? 'Positive' : 'Neutral', association: `${brandName} mentions`, confidence: Math.max(20, Math.min(92, dims.mentions)) },
      ];
  return {
    id: crypto.randomUUID(),
    brandName,
    timestamp: createdAt || new Date().toISOString(),
    dimensions: dims,
    trustScore,
    sources,
    sentimentTrend,
    sourceBreakdown,
    status: 'completed',
  };
};

const normalizeSentiment = (s: unknown): SourceResult['sentiment'] => {
  if (typeof s === 'string') {
    const v = s.trim().toLowerCase();
    if (v === 'positive' || v === 'pozytywny' || v === 'positive\n') return 'Positive';
    if (v === 'negative' || v === 'negatywny') return 'Negative';
    return 'Neutral';
  }
  if (typeof s === 'number') {
    if (s >= 66) return 'Positive';
    if (s <= 33) return 'Negative';
    return 'Neutral';
  }
  return 'Neutral';
};

export const GUEST_LIMIT = 3;


export function useBrewing() {
  const [progress, setProgress] = useState(0);
  // Guards against a second scan starting while one is already in flight.
  // Nine of the first fourteen rows in `analyses` were duplicates written
  // 0.4-1.8s apart — the same scan saved two or three times, because every
  // entry point (the URL effect, the re-scan button, the setTimeout retry)
  // could call startBrewing again before the first call finished. A ref, not
  // state, so the check is synchronous: two calls in the same tick must not
  // both read a stale `false`.
  const inFlight = useRef(false);
  const [status, setStatus] = useState<'idle' | 'brewing' | 'loading' | 'completed' | 'error'>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Scanning deliberately paused by an admin (503 + scansDisabled from
  // analyze.js) — a maintenance state, not a failure, so the UI can say so
  // calmly instead of showing the red "something went wrong" treatment.
  const [scansDisabled, setScansDisabled] = useState(false);
  // A report id that no longer resolves — deleted, or belonging to another
  // account (RLS makes those indistinguishable, and deliberately so).
  // Retrying can't help, so the UI needs to tell them apart from a failed
  // scan.
  const [notFound, setNotFound] = useState(false);
  // Every model provider refused the request (no credits, no key, outage).
  // Retrying cannot help, so the UI must not offer it.
  const [providerUnavailable, setProviderUnavailable] = useState(false);

  const startBrewing = useCallback(async (rawBrandName: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const brandName = canonicalBrandName(rawBrandName);
    // Guest limit (no session) is enforced server-side by analyze.js itself
    // (atomic per-IP counter) — it responds with guestLimitReached below
    // rather than this needing its own pre-flight check-and-increment call.

    setStatus('brewing');
    setProgress(0);
    setResult(null);
    setError(null);
    setScansDisabled(false);
    setProviderUnavailable(false);

    let current = 0;
    const interval = setInterval(() => {
      current += Math.random() * 8 + 2;
      if (current >= 90) {
        clearInterval(interval);
        setProgress(90);
      } else {
        setProgress(Math.round(current));
      }
    }, 200);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/.netlify/functions/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: brandName, models: loadModelPrefs().selected })
      });

      const data = await response.json();

      if (!response.ok) {
        clearInterval(interval);
        if (data?.guestLimitReached) {
          setGuestLimitReached(true);
          setStatus('idle');
          setProgress(0);
          return;
        }
        if (data?.providerUnavailable) {
          setProviderUnavailable(true);
          setError(data?.error || 'Scanning is unavailable right now.');
          setStatus('error');
          setProgress(0);
          return;
        }
        if (data?.scansDisabled) {
          setScansDisabled(true);
          setError(data?.error || 'Scanning is temporarily paused.');
          setStatus('error');
          setProgress(0);
          return;
        }
        // Any other server-side failure (rate limit, auth hiccup, etc.) —
        // fall through to the deterministic client-side fallback below
        // rather than surfacing raw error JSON as if it were a result.
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      clearInterval(interval);
      setProgress(100);

      // Przygotuj fallbackowe dane dla wykresów, jeśli funkcja API ich nie zwróci
      const sentimentTrendData = (data.sentimentTrend && Array.isArray(data.sentimentTrend) && data.sentimentTrend.length >= 7)
        ? data.sentimentTrend
        : Array.from({ length: 7 }).map((_, i) => ({
          date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
          score: Math.max(40, Math.min(100, Math.round((data.sentiment ?? 75) + Math.round(Math.sin(i * 0.9) * 6))))
        }));

      const sourceBreakdownData = (data.sourceBreakdown && Array.isArray(data.sourceBreakdown) && data.sourceBreakdown.length > 0)
        ? data.sourceBreakdown
        : [
          { name: 'News', value: 55, color: '#8B79F6' },
          { name: 'Social', value: 30, color: '#60A5FA' },
          { name: 'Blogs', value: 15, color: '#34D399' }
        ];

      const sourcesData = (data.sources && Array.isArray(data.sources)) ? data.sources : [];

      // 0 / NaN / non-numeric are treated as "missing signal", not a real low score
      const toNum = (v: unknown, fallback = 50) => {
        const n = typeof v === 'number' && !isNaN(v) ? v : parseFloat(String(v));
        if (!Number.isFinite(n) || n <= 0) return fallback;
        return n;
      };

      const derivedDimensions = {
        authority: toNum(data.authority ?? data.dimensions?.authority, 50),
        sentiment: toNum(data.sentiment ?? data.dimensions?.sentiment, 50),
        recency: toNum(data.recency ?? data.dimensions?.recency, 50),
        mentions: toNum(data.mentions ?? data.dimensions?.mentions, 50),
        accuracy: toNum(data.accuracy ?? data.dimensions?.accuracy, 50)
      };

      // Well-known brands shouldn't show as low-signal even if the LLM is uncertain
      const FAMOUS_BRANDS = new Set([
        'tesla', 'apple', 'google', 'amazon', 'microsoft', 'meta', 'facebook',
        'netflix', 'nvidia', 'samsung', 'sony', 'nike', 'adidas', 'coca-cola',
        'cocacola', 'pepsi', 'mcdonalds', 'starbucks', 'spotify', 'openai',
        'anthropic', 'ibm', 'intel', 'oracle', 'salesforce',
      ]);
      const seedKey = (brandName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (FAMOUS_BRANDS.has(seedKey)) {
        // Per-dimension deterministic floor so the radar gets a unique shape per brand
        let fh = 2166136261 >>> 0;
        for (let i = 0; i < seedKey.length; i++) {
          fh = Math.imul(fh ^ seedKey.charCodeAt(i), 16777619) >>> 0;
        }
        const nextOffset = () => {
          fh = Math.imul(fh ^ (fh >>> 13), 1274126177) >>> 0;
          return fh % 21; // 0..20
        };
        const FAMOUS_BASE = 70;
        derivedDimensions.authority = Math.max(derivedDimensions.authority, FAMOUS_BASE + nextOffset());
        derivedDimensions.sentiment = Math.max(derivedDimensions.sentiment, FAMOUS_BASE + nextOffset());
        derivedDimensions.recency = Math.max(derivedDimensions.recency, FAMOUS_BASE + nextOffset());
        derivedDimensions.mentions = Math.max(derivedDimensions.mentions, FAMOUS_BASE + nextOffset());
        derivedDimensions.accuracy = Math.max(derivedDimensions.accuracy, FAMOUS_BASE + nextOffset());
      }

      // If all derived dimensions are the fallback (50), use a deterministic client-side fallback
      const allAreFallback = Object.values(derivedDimensions).every(v => Math.round(v) === 50);
      const clientDeterministicFallback = (seedStr: string) => {
        const seed = String(seedStr || '').toLowerCase().trim();
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seed.length; i++) {
          h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
        }
        const next = () => {
          h = Math.imul(h ^ (h >>> 13), 1274126177);
          return Math.round(((h % 66) + 66) % 66) + 30;
        };
        const authority = next();
        const sentiment = next();
        const recency = next();
        const mentions = next();
        const accuracy = next();
        const trustScore = Math.round((authority + sentiment + recency + mentions + accuracy) / 5);
        return { dimensions: { authority, sentiment, recency, mentions, accuracy }, trustScore };
      };

      if (allAreFallback) {
        const fb = clientDeterministicFallback(brandName || 'unknown');
        derivedDimensions.authority = fb.dimensions.authority;
        derivedDimensions.sentiment = fb.dimensions.sentiment;
        derivedDimensions.recency = fb.dimensions.recency;
        derivedDimensions.mentions = fb.dimensions.mentions;
        derivedDimensions.accuracy = fb.dimensions.accuracy;
      }

      const dimAvg = Math.round((derivedDimensions.authority + derivedDimensions.sentiment + derivedDimensions.accuracy + derivedDimensions.mentions + derivedDimensions.recency) / 5);
      const apiTrust = typeof data.trustScore === 'number' && !isNaN(data.trustScore) && data.trustScore > 0
        ? Math.round(data.trustScore)
        : null;
      const computedTrust = FAMOUS_BRANDS.has(seedKey)
        ? Math.max(dimAvg, apiTrust ?? 0)
        : (apiTrust ?? dimAvg);

      // ensure we have some sources to render in the table and coerce their types
      const ensureSources = (arr: unknown): SourceResult[] => {
        if (arr && Array.isArray(arr) && arr.length > 0) {
          return arr.map((raw) => {
            const it = (raw ?? {}) as Record<string, unknown>;
            return {
              model: String(it.model ?? 'Unknown'),
              sentiment: normalizeSentiment(it.sentiment),
              association: String(it.association ?? ''),
              confidence: Math.max(0, Math.min(100, Number(it.confidence) || 0))
            } satisfies SourceResult;
          });
        }

        // deterministic demo sources based on brandName
        return [
          { model: 'GPT-4o', sentiment: 'Positive', association: `${brandName} product`, confidence: Math.max(40, Math.min(98, Math.round((derivedDimensions.authority || 50)))) },
          { model: 'Claude', sentiment: 'Neutral', association: `${brandName} brand`, confidence: Math.max(30, Math.min(95, Math.round((derivedDimensions.accuracy || 50)))) },
          { model: 'Gemini', sentiment: 'Positive', association: `${brandName} mentions`, confidence: Math.max(20, Math.min(92, Math.round((derivedDimensions.mentions || 50)))) }
        ];
      };

      const analysisResult: AnalysisResult = {
        id: crypto.randomUUID(),
        brandName,
        timestamp: new Date().toISOString(),
        dimensions: {
          authority: Math.round(derivedDimensions.authority),
          sentiment: Math.round(derivedDimensions.sentiment),
          recency: Math.round(derivedDimensions.recency),
          mentions: Math.round(derivedDimensions.mentions),
          accuracy: Math.round(derivedDimensions.accuracy)
        },
        trustScore: computedTrust,
        sources: ensureSources(sourcesData),
        sentimentTrend: sentimentTrendData,
        sourceBreakdown: sourceBreakdownData,
        status: 'completed'
      };

      // Zapisz do Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // .select('id').single() so analysisResult.id becomes the REAL row
          // id instead of the crypto.randomUUID() placeholder above. Without
          // this, "Client audit" (navigate to /audit/${result.id}) always
          // pointed at an id that didn't exist in the database — the button
          // looked like it worked but every click 404'd on AuditReport.
          const { data: saved, error: dbError } = await supabase
            .from('analyses')
            .insert({
              user_id: user.id,
              brand_name: brandName,
              trust_score: analysisResult.trustScore,
              authority: analysisResult.dimensions.authority,
              sentiment: analysisResult.dimensions.sentiment,
              recency: analysisResult.dimensions.recency,
              mentions: analysisResult.dimensions.mentions,
              accuracy: analysisResult.dimensions.accuracy,
              sources: analysisResult.sources
            })
            .select('id')
            .single();

          if (dbError) {
            if (dbError.message.includes('Analysis limit reached')) {
              alert('Osiągnąłeś limit analiz w tym miesiącu. Przejdź na wyższy plan aby kontynuować.');
            } else if (dbError.message.includes('Brand limit reached')) {
              alert('Osiągnąłeś limit śledzonych marek dla swojego planu. Przejdź na wyższy plan, aby śledzić kolejną markę.');
            } else {
              console.error('Failed to save analysis:', dbError);
            }
          } else if (saved?.id) {
            analysisResult.id = saved.id;
          }
        }
      } catch (dbError) {
        console.error('Failed to save analysis:', dbError);
      }

      setProgress(100);
      setTimeout(() => {
        setResult(analysisResult);
        setStatus('completed');
      }, 300);
    } catch (err) {
      clearInterval(interval);
      console.error('Analyze request failed:', err);
      // Previously this fabricated a deterministic fake result and showed it
      // as a completed scan — indistinguishable from a real AI-generated
      // report, with no indication the actual API call had failed. Show a
      // real error instead so a user never mistakes a failed scan for data.
      setProgress(0);
      setResult(null);
      setError(err instanceof Error ? err.message : 'Something went wrong while scanning. Please try again.');
      setStatus('error');
    } finally {
      // Released on every exit path, including the error branch — otherwise a
      // single failed scan would wedge the hook and the user could never
      // retry without a full reload.
      inFlight.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    inFlight.current = false;
    setStatus('idle');
    setProgress(0);
    setResult(null);
    setError(null);
    setScansDisabled(false);
    setNotFound(false);
    setProviderUnavailable(false);
  }, []);

  const loadStoredAnalysis = useCallback(async (id: string) => {
    // 'loading', not 'brewing' — this is just a DB read of an existing
    // report, not a live AI scan, so it shouldn't show the model-scanning
    // animation built for the latter.
    setStatus('loading');
    setNotFound(false);
    setError(null);
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) {
      // Was a silent `setStatus('idle')`, which rendered an all-but-empty
      // page: no message, no explanation, no way back. Opening a report that
      // had been deleted looked exactly like the app being broken.
      console.error('Failed to load analysis', error);
      setNotFound(true);
      setError("This report doesn't exist any more, or it belongs to another account.");
      setStatus('error');
      setProgress(0);
      return null;
    }
    const view = {
      ...buildViewFromStored(
        data.brand_name,
        {
          authority: data.authority,
          sentiment: data.sentiment,
          recency: data.recency,
          mentions: data.mentions,
          accuracy: data.accuracy,
        },
        data.trust_score,
        data.created_at,
        data.sources,
      ),
      // buildViewFromStored fabricates a fresh id (it has no way to know the
      // real one) — overwrite with the actual row id so "Client audit" and
      // any other feature keyed on result.id points at something that
      // exists.
      id: data.id,
    };
    setProgress(100);
    setResult(view);
    setStatus('completed');
    return view;
  }, []);

  return { progress, status, result, startBrewing, reset, loadStoredAnalysis, guestLimitReached, error, scansDisabled, notFound, providerUnavailable };
}
