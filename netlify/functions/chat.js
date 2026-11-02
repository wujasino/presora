import { createClient } from '@supabase/supabase-js';
import ws from "ws";

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const MAX_REQUESTS_PER_WINDOW = Number(process.env.MAX_REQUESTS_PER_WINDOW || 15);
const MAX_REQUESTS_PER_DAY = Number(process.env.MAX_REQUESTS_PER_DAY || 300);
const EXTERNAL_TIMEOUT_MS = 25_000;
const MAX_TOOL_ITERATIONS = 6;

// In-memory store: secondary defense only — primary rate limiting is per user ID (verified via JWT)
const requestStore = new Map();
const now = () => Date.now();

const shouldRateLimit = (key) => {
  const current = now();
  const entry = requestStore.get(key) || {
    count: 0, windowStart: current, dailyCount: 0,
    dailyReset: current + 24 * 60 * 60 * 1000, lastRequest: current
  };
  if (current > entry.dailyReset) {
    entry.dailyCount = 0; entry.dailyReset = current + 24 * 60 * 60 * 1000;
    entry.windowStart = current; entry.count = 0;
  }
  if (current - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.windowStart = current; entry.count = 0;
  }
  entry.count += 1; entry.dailyCount += 1; entry.lastRequest = current;
  requestStore.set(key, entry);
  return entry.count > MAX_REQUESTS_PER_WINDOW || entry.dailyCount > MAX_REQUESTS_PER_DAY;
};

const createAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role configuration');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { params: { eventsPerSecond: 0 } },
  });
};

const fetchWithTimeout = (url, options) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
};

/* ── Config helpers (all scoped to the verified user id) ─────────────── */

const KNOWN_MODELS = ['gpt-4o', 'claude', 'gemini', 'perplexity', 'mistral', 'llama'];
const clampStr = (s, n = 120) => String(s ?? '').trim().slice(0, n);

const loadConfig = async (admin, userId) => {
  const { data } = await admin
    .from('brand_monitors')
    .select('brand, competitors, frequency, models, alert_metric, alert_threshold, enabled')
    .eq('user_id', userId)
    .maybeSingle();
  return data || {
    brand: null, competitors: [], frequency: 'weekly',
    models: ['gpt-4o', 'claude', 'gemini'], alert_metric: null,
    alert_threshold: null, enabled: true,
  };
};

const persistConfig = async (admin, userId, next) => {
  const { data, error } = await admin
    .from('brand_monitors')
    .upsert({ user_id: userId, ...next }, { onConflict: 'user_id' })
    .select('brand, competitors, frequency, models, alert_metric, alert_threshold, enabled')
    .single();
  if (error) throw new Error(error.message);
  return data;
};

/* Pure config reducer — validates & clamps, never touches the DB.
   Used both to preview staged changes and to apply confirmed ones. */
export const reduceConfig = (cfg, name, input = {}) => {
  const next = { ...cfg, competitors: [...(cfg.competitors || [])], models: [...(cfg.models || [])] };
  switch (name) {
    case 'set_brand':
      next.brand = clampStr(input.brand);
      break;
    case 'add_competitor': {
      const c = clampStr(input.name);
      if (c && !next.competitors.some(x => x.toLowerCase() === c.toLowerCase())) {
        next.competitors = [...next.competitors, c].slice(0, 10);
      }
      break;
    }
    case 'remove_competitor': {
      const t = clampStr(input.name).toLowerCase();
      next.competitors = next.competitors.filter(x => x.toLowerCase() !== t);
      break;
    }
    case 'set_schedule':
      next.frequency = ['daily', 'weekly', 'monthly'].includes(input.frequency) ? input.frequency : 'weekly';
      break;
    case 'set_alert': {
      const metric = input.metric === null ? null : clampStr(input.metric);
      if (metric === null) { next.alert_metric = null; next.alert_threshold = null; }
      else if (['sentiment', 'visibility', 'mentions'].includes(metric)) {
        next.alert_metric = metric;
        next.alert_threshold = Math.max(0, Math.min(100, Math.round(Number(input.threshold ?? 60))));
      }
      break;
    }
    case 'select_models': {
      const models = (Array.isArray(input.models) ? input.models : [])
        .map(m => clampStr(m).toLowerCase())
        .filter(m => KNOWN_MODELS.includes(m));
      if (models.length) next.models = [...new Set(models)];
      break;
    }
    default:
      break;
  }
  return next;
};

/* Human-readable one-liner describing a proposed action. */
export const labelFor = (name, input = {}) => {
  switch (name) {
    case 'set_brand':        return `Monitor brand: ${clampStr(input.brand)}`;
    case 'add_competitor':   return `Add competitor: ${clampStr(input.name)}`;
    case 'remove_competitor':return `Remove competitor: ${clampStr(input.name)}`;
    case 'set_schedule':     return `Scan schedule: ${input.frequency}`;
    case 'set_alert':        return input.metric === null
                               ? 'Clear metric alert'
                               : `Alert when ${clampStr(input.metric)} < ${Math.max(0, Math.min(100, Math.round(Number(input.threshold ?? 60))))}`;
    case 'select_models':    return `Query models: ${(Array.isArray(input.models) ? input.models : []).map(m => clampStr(m)).join(', ')}`;
    default:                 return name;
  }
};

const WRITE_TOOLS = new Set(['set_brand', 'add_competitor', 'remove_competitor', 'set_schedule', 'set_alert', 'select_models']);

/* ── Tool definitions exposed to Claude ──────────────────────────────── */

export const MONITORING_ASSISTANT_TOOLS = [
  {
    name: 'get_config',
    description: 'Read the user\'s current brand monitoring configuration. Call this first if you are unsure of the current state.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'set_brand',
    description: 'Set the primary brand the user wants to monitor in AI models.',
    input_schema: {
      type: 'object',
      properties: { brand: { type: 'string', description: 'Brand name or website, e.g. "Nike" or "acme.com".' } },
      required: ['brand'],
    },
  },
  {
    name: 'add_competitor',
    description: 'Add a competitor brand to track side-by-side with the primary brand.',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    name: 'remove_competitor',
    description: 'Remove a competitor from tracking.',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    name: 'set_schedule',
    description: 'Set how often the automated monitoring scan runs.',
    input_schema: {
      type: 'object',
      properties: { frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] } },
      required: ['frequency'],
    },
  },
  {
    name: 'set_alert',
    description: 'Set an alert that notifies the user when a metric drops below a threshold. Pass metric=null to clear the alert.',
    input_schema: {
      type: 'object',
      properties: {
        metric: { type: ['string', 'null'], enum: ['sentiment', 'visibility', 'mentions', null] },
        threshold: { type: 'number', description: '0-100. The alert fires when the metric falls below this.' },
      },
      required: ['metric'],
    },
  },
  {
    name: 'select_models',
    description: 'Choose which AI models the monitoring queries. Valid: gpt-4o, claude, gemini, perplexity, mistral, llama.',
    input_schema: {
      type: 'object',
      properties: { models: { type: 'array', items: { type: 'string' } } },
      required: ['models'],
    },
  },
];

export const MONITORING_ASSISTANT_SYSTEM_PROMPT = `You are Presora's setup assistant. You help brand owners and marketers configure their AI-visibility monitoring entirely through chat — no forms.

You can set the primary brand, add/remove competitors, set the scan schedule (daily/weekly/monthly), choose which AI models to query, and set a drop alert on a metric (sentiment/visibility/mentions).

IMPORTANT — nothing you configure is saved immediately. Your write tool calls are staged as a proposal that the user must confirm with an "Apply" button. So:
- When the user asks for changes, make all the needed tool calls to build the full proposal.
- Then describe what you're PROPOSING (not what you "did" or "saved") in one or two plain sentences, and tell them to review and hit Apply to confirm.
- Read the current state with get_config when you need it.

Other guidelines:
- Be warm, concise and plain-spoken. These are marketers, not engineers.
- If a request is ambiguous (e.g. an alert without a threshold), pick a sensible default (threshold 60) and say what you chose so they can adjust before applying.
- Never invent competitors or brands the user did not mention.
- You only configure monitoring. You do not run scans, change billing, or promise features that don't exist.`;

export const MONITORING_ASSISTANT_MODEL = 'claude-sonnet-5';

/* ── Anthropic tool-use loop ─────────────────────────────────────────── */

const callAnthropic = (messages) => fetchWithTimeout('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: MONITORING_ASSISTANT_MODEL,
    max_tokens: 1024,
    system: MONITORING_ASSISTANT_SYSTEM_PROMPT,
    tools: MONITORING_ASSISTANT_TOOLS,
    messages,
  }),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (event.body && event.body.length > 32 * 1024) {
    return { statusCode: 413, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Payload too large' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.toString().replace(/^Bearer\s+/i, '');
  if (!token) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let authedUser = null;
  let admin = null;
  try {
    admin = createAdminClient();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    authedUser = user;
    if (shouldRateLimit(`user:${user.id}`)) {
      return { statusCode: 429, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Too many requests. Please try again in a moment.' }) };
    }
  } catch {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Authentication failed. Please try again.' }) };
  }

  // ── Apply mode: persist a proposal the user just confirmed ──────────
  // The client sends back the staged actions; we re-validate every one
  // server-side (never trusting the client) before a single upsert.
  try {
    const parsed = JSON.parse(event.body || '{}');
    if (Array.isArray(parsed.apply)) {
      const actions = parsed.apply.slice(0, 20);
      let next = await loadConfig(admin, authedUser.id);
      for (const a of actions) {
        if (a && WRITE_TOOLS.has(a.name)) {
          next = reduceConfig(next, a.name, a.input || {});
        }
      }
      const config = await persistConfig(admin, authedUser.id, next);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applied: true, config }),
      };
    }
  } catch (err) {
    console.error('chat apply error:', err.message);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Could not save your changes. Please try again.' }) };
  }

  // Graceful degradation when the model key is not configured.
  if (!process.env.ANTHROPIC_API_KEY) {
    const config = await loadConfig(admin, authedUser.id).catch(() => null);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply: "The chat assistant isn't fully connected yet (missing model key), but your monitoring settings are safe. You can still configure everything from the dashboard.",
        config,
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const incoming = Array.isArray(body.messages) ? body.messages : [];

    // Normalize client history into Anthropic message format (string content).
    const messages = incoming
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
      .slice(-16)
      .map(m => ({ role: m.role, content: clampStr(m.text, 4000) }));

    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'A user message is required.' }) };
    }

    // The saved state, plus a working copy that accumulates *staged* changes.
    // Nothing here is written to the DB — write tools only preview.
    const savedConfig = await loadConfig(admin, authedUser.id);
    let workingConfig = { ...savedConfig };
    const pending = [];

    let finalText = '';
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const res = await callAnthropic(messages);
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.warn('Anthropic error', res.status, errBody.slice(0, 200));
        throw new Error('Model request failed');
      }
      const data = await res.json();
      const content = Array.isArray(data.content) ? data.content : [];

      // Collect any assistant text in this turn.
      finalText = content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || finalText;

      if (data.stop_reason !== 'tool_use') break;

      messages.push({ role: 'assistant', content });
      const toolResults = [];
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        let result;
        if (block.name === 'get_config') {
          // Read tool reflects the working (staged) state so Claude reasons correctly.
          result = workingConfig;
        } else if (WRITE_TOOLS.has(block.name)) {
          // Stage — do not persist. Preview the resulting config and queue the action.
          workingConfig = reduceConfig(workingConfig, block.name, block.input || {});
          pending.push({ name: block.name, input: block.input || {}, label: labelFor(block.name, block.input || {}) });
          result = { staged: true, resulting_config: workingConfig };
        } else {
          result = { error: `Unknown tool: ${block.name}` };
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply: finalText || 'Done.',
        config: savedConfig,          // what's currently saved
        pending,                      // proposed actions awaiting confirmation
        preview: pending.length ? workingConfig : null, // resulting config if applied
      }),
    };
  } catch (error) {
    console.error('chat handler error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'The assistant hit a snag. Please try again.' }),
    };
  }
};
