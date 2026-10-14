const HEDGE_PATTERNS = [
  /\bmight be\b/i, /\bmay be\b/i, /\bpossibly\b/i, /\bnot (?:certain|sure)\b/i,
  /\bI(?:'m| am) not (?:aware|familiar)\b/i, /\bI don't have (?:specific|enough|detailed)\b/i,
  /\bas of my (?:last update|knowledge cutoff|training)\b/i, /\bappears to\b/i,
  /\bcould be\b/i, /\bunclear\b/i, /\bunverified\b/i, /\bI (?:couldn't|could not) find\b/i,
  /\bno (?:reliable|clear) information\b/i, /\bI don't have (?:access to|information about)\b/i,
];

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

export const reputationBrandKey = (raw) => String(raw || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .replace(/\/.*$/, '')
  .replace(/\.(com|net|org|io|app|co|ai|dev|xyz|pl|eu|de|fr|es|it|uk)$/, '')
  .replace(/\s+/g, ' ')
  .trim();

const dropSeverity = (delta, current) => {
  if (current < 40 || delta >= 20) return 'critical';
  if (current < 50 || delta >= 12) return 'high';
  return 'medium';
};

const weakScoreSeverity = (score) => {
  if (score < 35) return 'critical';
  if (score < 50) return 'high';
  return 'medium';
};

const hedgeEvidence = (sources) => (Array.isArray(sources) ? sources : [])
  .map((source) => {
    const association = typeof source?.association === 'string' ? source.association.trim() : '';
    const hedge = HEDGE_PATTERNS.map((pattern) => association.match(pattern)?.[0]).find(Boolean);
    return hedge ? {
      model: String(source?.model || 'Unknown model').slice(0, 80),
      phrase: hedge.slice(0, 80),
      excerpt: association.slice(0, 300),
    } : null;
  })
  .filter(Boolean)
  .slice(0, 5);

/**
 * Convert one real scheduled scan into evidence-backed reputation incidents.
 * No incident is created from a deterministic fallback result.
 */
export const deriveReputationIncidents = ({ brandName, previous, result, competitor }) => {
  if (!result || result.isFallback) return [];

  const brand = String(brandName || '').trim().slice(0, 160);
  const trustScore = clampScore(result.trustScore);
  const accuracy = clampScore(result.accuracy);
  const incidents = [];

  if (trustScore < 60) {
    incidents.push({
      type: 'low_visibility',
      severity: weakScoreSeverity(trustScore),
      title: `AI visibility is weak for ${brand}`,
      summary: `${brand} scored ${trustScore}/100 in the latest monitored scan. This is below the level where Presora treats visibility as healthy.`,
      recommendedAction: 'Open the latest report, generate the action plan and address the weakest measured dimension first.',
      evidence: { trustScore, threshold: 60 },
    });
  }

  const previousScore = previous?.trust_score == null ? null : clampScore(previous.trust_score);
  const delta = previousScore === null ? 0 : previousScore - trustScore;
  if (previousScore !== null && delta >= 5) {
    incidents.push({
      type: 'score_drop',
      severity: dropSeverity(delta, trustScore),
      title: `${brand}'s AI visibility dropped by ${delta} points`,
      summary: `The monitored score moved from ${previousScore} to ${trustScore}. The change is larger than the five-point noise guardrail.`,
      recommendedAction: 'Compare the latest model associations with the previous report and correct the highest-impact change before the next scan.',
      evidence: { previousScore, currentScore: trustScore, delta },
    });
  }

  if (accuracy < 60) {
    incidents.push({
      type: 'low_accuracy',
      severity: weakScoreSeverity(accuracy),
      title: `AI accuracy risk detected for ${brand}`,
      summary: `Accuracy scored ${accuracy}/100. This does not prove a factual error, but it is a strong signal that model answers need human verification.`,
      recommendedAction: 'Review the raw model associations against verified company facts, then strengthen the affected facts on owned pages and structured data.',
      evidence: { accuracy, threshold: 60 },
    });
  }

  const hedged = hedgeEvidence(result.sources);
  if (hedged.length > 0) {
    incidents.push({
      type: 'model_uncertainty',
      severity: hedged.length >= 3 ? 'high' : 'medium',
      title: `AI models are uncertain about ${brand}`,
      summary: `${hedged.length} model answer${hedged.length === 1 ? '' : 's'} used uncertainty language in the latest scan.`,
      recommendedAction: 'Verify each quoted statement and add a clear, crawlable source for facts that models could not state confidently.',
      evidence: { models: hedged },
    });
  }

  const competitorScore = competitor?.last_score == null ? null : clampScore(competitor.last_score);
  const competitorGap = competitorScore === null ? 0 : competitorScore - trustScore;
  // Competitive urgency is evidence-gated and only appears for a genuinely
  // weak brand score. A healthy user should not be frightened into action.
  if (trustScore < 60 && competitorScore !== null && competitorGap >= 10) {
    const competitorName = String(competitor.competitor_name || 'A tracked competitor').slice(0, 160);
    incidents.push({
      type: 'competitor_gap',
      severity: competitorGap >= 25 ? 'critical' : competitorGap >= 15 ? 'high' : 'medium',
      title: `${competitorName} leads ${brand} in AI visibility`,
      summary: `${competitorName} scored ${competitorScore}/100 versus ${trustScore}/100 for ${brand}, a measured gap of ${competitorGap} points.`,
      recommendedAction: 'Compare both reports and prioritise the dimension where the competitor has the clearest measured advantage.',
      evidence: { competitorName, competitorScore, brandScore: trustScore, gap: competitorGap },
    });
  }

  return incidents;
};

export const syncReputationIncidents = async ({ admin, monitor, analysisId, previous, result }) => {
  const brandKey = reputationBrandKey(monitor.brand);
  const { data: competitor } = await admin
    .from('tracked_competitors')
    .select('competitor_name, last_score, last_scanned_at')
    .eq('user_id', monitor.user_id)
    .eq('brand_key', brandKey)
    .not('last_score', 'is', null)
    .order('last_score', { ascending: false })
    .limit(1)
    .maybeSingle();

  const detected = deriveReputationIncidents({
    brandName: monitor.brand,
    previous,
    result,
    competitor,
  });
  const now = new Date().toISOString();

  const { data: currentRows, error: currentRowsError } = await admin
    .from('reputation_incidents')
    .select('id, incident_type, dedupe_key, status, resolved_at')
    .eq('monitor_id', monitor.id);
  if (currentRowsError) throw new Error(`Could not load reputation incidents: ${currentRowsError.message}`);
  const currentByKey = new Map((currentRows || []).map((incident) => [incident.dedupe_key, incident]));

  if (detected.length > 0) {
    const rows = detected.map((incident) => {
      const dedupeKey = `${monitor.id}:${incident.type}`;
      const existing = currentByKey.get(dedupeKey);
      const ignored = existing?.status === 'ignored';
      return {
        user_id: monitor.user_id,
        analysis_id: analysisId,
        monitor_id: monitor.id,
        brand_name: String(monitor.brand).trim().slice(0, 160),
        incident_type: incident.type,
        severity: incident.severity,
        status: ignored ? 'ignored' : 'open',
        title: incident.title,
        summary: incident.summary,
        recommended_action: incident.recommendedAction,
        evidence: incident.evidence,
        dedupe_key: dedupeKey,
        last_seen_at: now,
        resolved_at: ignored ? existing.resolved_at : null,
        updated_at: now,
      };
    });
    const { error } = await admin
      .from('reputation_incidents')
      .upsert(rows, { onConflict: 'user_id,dedupe_key' });
    if (error) throw new Error(`Could not save reputation incidents: ${error.message}`);
  }

  const activeTypes = new Set(detected.map((incident) => incident.type));
  const recoveredIds = (currentRows || [])
    .filter((incident) => incident.status === 'open' && !activeTypes.has(incident.incident_type))
    .map((incident) => incident.id);
  if (recoveredIds.length > 0) {
    const { error } = await admin
      .from('reputation_incidents')
      .update({ status: 'resolved', resolved_at: now, updated_at: now })
      .in('id', recoveredIds);
    if (error) throw new Error(`Could not resolve recovered incidents: ${error.message}`);
  }

  return detected;
};
