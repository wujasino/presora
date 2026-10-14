import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('Missing RESEND_API_KEY. Run this with the production Resend key.');
  process.exit(1);
}

const resend = new Resend(apiKey);
const enabled = process.argv.includes('--enable');
const from = process.env.RESEND_FROM || 'Presora <noreply@presora.app>';
const marketingFrom = process.env.RESEND_MARKETING_FROM || from;
const replyTo = process.env.RESEND_REPLY_TO;

const events = {
  'presora.user.activated': { first_name: 'string', plan: 'string', dashboard_url: 'string', pricing_url: 'string', unsubscribe_url: 'string' },
  'presora.nurture.started': { first_name: 'string', plan: 'string', dashboard_url: 'string', pricing_url: 'string', unsubscribe_url: 'string' },
  'presora.analysis.completed': { first_name: 'string', brand_name: 'string', visibility_score: 'number', plan: 'string', dashboard_url: 'string', pricing_url: 'string', unsubscribe_url: 'string' },
  'presora.analysis.nurture_started': { first_name: 'string', brand_name: 'string', visibility_score: 'number', plan: 'string', dashboard_url: 'string', pricing_url: 'string', unsubscribe_url: 'string' },
  'presora.analysis.low_score': { first_name: 'string', brand_name: 'string', visibility_score: 'number', weakest_dimension: 'string', weakest_score: 'number', quick_win: 'string', plan: 'string', dashboard_url: 'string', pricing_url: 'string', unsubscribe_url: 'string' },
  'presora.analysis.competitor_gap': { first_name: 'string', brand_name: 'string', visibility_score: 'number', weakest_dimension: 'string', weakest_score: 'number', quick_win: 'string', competitor_name: 'string', competitor_score: 'number', score_gap: 'number', plan: 'string', dashboard_url: 'string', pricing_url: 'string', unsubscribe_url: 'string' },
  'presora.subscription.started': { first_name: 'string', plan: 'string', dashboard_url: 'string', pricing_url: 'string', unsubscribe_url: 'string' },
  'presora.payment.failed': { first_name: 'string', plan: 'string', dashboard_url: 'string', pricing_url: 'string', unsubscribe_url: 'string' },
};

const shell = (content, cta, href, marketing = false) => `<!doctype html><html><body style="margin:0;background:#ffffff;color:#111827;font-family:Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="display:none;max-height:0;overflow:hidden;color:transparent">A practical next step based on your Presora activity.</div><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:32px 18px"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px"><tr><td style="padding:0 0 28px;font-weight:700;font-size:18px;color:#111827">Presora</td></tr><tr><td>${content}<p style="margin:26px 0 30px"><a href="${href}" style="color:#5b3fd6;text-decoration:underline;font-weight:700">${cta} →</a></p><p style="margin:0 0 30px;color:#374151;font-size:14px;line-height:1.7">Best,<br>Patryk from Presora</p></td></tr><tr><td style="padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px;line-height:1.6">${marketing ? 'You are receiving this because you asked Presora for product updates or recommendations. <a href="{{{UNSUBSCRIBE_URL}}}" style="color:#6b7280">Unsubscribe in one click</a>.' : 'This transactional message relates to activity on your Presora account.'}</td></tr></table></td></tr></table></body></html>`;

const heading = (title, lead, body) => `<p style="margin:0 0 22px;color:#111827;font-size:15px;line-height:1.6">Hi {{{FIRST_NAME}}},</p><h1 style="margin:0 0 12px;color:#111827;font-size:22px;line-height:1.3">${title}</h1><p style="margin:0 0 18px;color:#374151;font-size:16px;line-height:1.65">${lead}</p><div style="color:#4b5563;font-size:14px;line-height:1.7">${body}</div>`;

const templates = [
  {
    alias: 'presora-lifecycle-welcome', name: 'Presora — activated account', subject: 'Your AI visibility baseline starts here',
    html: shell(heading('Start with one answer you can improve.', 'Your Presora account is ready.', '<p>Run your first scan to see how ChatGPT, Claude, and Gemini describe your brand today. Save the result as a baseline, choose one recommendation, and measure the improvement after you act.</p><p><strong style="color:#111827">Your first win:</strong> replace guessing with a clear starting point.</p>'), 'Create your free baseline', 'https://www.presora.app/dashboard'),
  },
  {
    alias: 'presora-lifecycle-first-scan', name: 'Presora — first scan reminder', subject: 'Find your easiest AI visibility win',
    html: shell(heading('Turn one buyer question into an opportunity.', 'A useful baseline takes about 15 seconds.', '<p>Before you scan, write down the question a customer asks just before choosing a provider. Use that exact topic in Presora, then check three things:</p><ol style="padding-left:20px"><li>Is your brand mentioned?</li><li>Is the description accurate?</li><li>Which source could strengthen the answer?</li></ol><p>You keep that checklist whether or not you ever upgrade.</p>'), 'Find my first opportunity', 'https://www.presora.app/dashboard', true), marketing: true,
  },
  {
    alias: 'presora-lifecycle-competitors', name: 'Presora — value loop follow-up', subject: 'A simple 20-minute AI visibility routine',
    html: shell(heading('Use the result, not just the score.', 'A small repeatable routine creates more value than a one-off audit.', '<ol style="padding-left:20px"><li><strong style="color:#111827">Measure:</strong> save today’s answer.</li><li><strong style="color:#111827">Explain:</strong> identify one missing or inaccurate signal.</li><li><strong style="color:#111827">Act:</strong> improve the strongest relevant page or source.</li><li><strong style="color:#111827">Measure again:</strong> verify what changed.</li></ol><p>Start free and leave with a prioritized next step.</p>'), 'Start the improvement loop', 'https://www.presora.app/dashboard', true), marketing: true,
  },
  {
    alias: 'presora-lifecycle-scan-ready', name: 'Presora — scan ready', subject: 'Your AI visibility scan is ready',
    html: shell(heading('Your result is ready.', 'You now have a baseline you can improve.', '<p>Open the report and choose the highest-impact opportunity you can realistically complete this week. Prioritize accuracy first, then authority and mentions. That gives you a useful result without creating an endless task list.</p>'), 'Choose my next action', 'https://www.presora.app/dashboard'),
  },
  {
    alias: 'presora-lifecycle-action', name: 'Presora — act on scan', subject: 'Turn your scan into one measurable win',
    html: shell(heading('Make the next step small and measurable.', 'Pick one improvement you can finish, then verify the effect.', '<p>If the answer is inaccurate, clarify the core facts on your strongest page. If authority is weak, add evidence and credible references. If mentions are low, strengthen the pages that answer real buyer questions.</p><p>Paid plans help you explain, prioritize, and track this work faster—but the action itself should already be clear.</p>'), 'Build my action loop', 'https://www.presora.app/pricing', true), marketing: true,
  },
  {
    alias: 'presora-lifecycle-measure-again', name: 'Presora — measure again', subject: 'See how far your AI visibility has moved',
    html: shell(heading('Measure the progress you created.', 'Keep what worked and stop spending time on what did not.', '<p>After publishing an improvement, scan the same topic again. Compare the description, sources, mentions, and score with your baseline. A better answer tells you what to repeat; no change tells you where not to invest more time yet.</p>'), 'Track my progress', 'https://www.presora.app/pricing', true), marketing: true,
  },
  {
    alias: 'presora-lifecycle-low-score', name: 'Presora — low score quick win', subject: 'Your clearest AI visibility opportunity: {{{WEAKEST_DIMENSION}}}',
    html: shell(heading('{{{BRAND_NAME}}}: start with {{{WEAKEST_DIMENSION}}}.', 'Your overall visibility score is {{{VISIBILITY_SCORE}}}/100, and {{{WEAKEST_DIMENSION}}} is the clearest place to improve first.', '<p><strong style="color:#111827">One practical next step:</strong><br>{{{QUICK_WIN}}}</p><p>Complete that action before changing anything else, then repeat the same scan to see whether the answer improves.</p>'), 'Open my action plan', 'https://www.presora.app/dashboard', true), marketing: true,
    dynamicVariables: [
      { key: 'BRAND_NAME', type: 'string', fallbackValue: 'Your brand' },
      { key: 'VISIBILITY_SCORE', type: 'number', fallbackValue: 0 },
      { key: 'WEAKEST_DIMENSION', type: 'string', fallbackValue: 'Authority' },
      { key: 'QUICK_WIN', type: 'string', fallbackValue: 'Strengthen the page that best answers your buyer’s main question.' },
    ],
  },
  {
    alias: 'presora-lifecycle-competitor-gap', name: 'Presora — measured competitor gap', subject: '{{{COMPETITOR_NAME}}} leads by {{{SCORE_GAP}}} points in AI visibility',
    html: shell(heading('AI currently has a stronger signal for {{{COMPETITOR_NAME}}}.', 'This is a measured comparison—not a generic warning. {{{BRAND_NAME}}} scored {{{VISIBILITY_SCORE}}}, while {{{COMPETITOR_NAME}}} scored {{{COMPETITOR_SCORE}}}.', '<p>The {{{SCORE_GAP}}}-point gap is most actionable in <strong style="color:#111827">{{{WEAKEST_DIMENSION}}}</strong>.</p><p><strong style="color:#111827">Close one part of the gap now:</strong><br>{{{QUICK_WIN}}}</p><p>Make that improvement, then scan both brands again. The goal is not more activity—it is a smaller measured gap.</p>'), 'See the measured gap', 'https://www.presora.app/competitor-tracker', true), marketing: true,
    dynamicVariables: [
      { key: 'BRAND_NAME', type: 'string', fallbackValue: 'Your brand' },
      { key: 'VISIBILITY_SCORE', type: 'number', fallbackValue: 0 },
      { key: 'WEAKEST_DIMENSION', type: 'string', fallbackValue: 'Authority' },
      { key: 'QUICK_WIN', type: 'string', fallbackValue: 'Strengthen the page that best answers your buyer’s main question.' },
      { key: 'COMPETITOR_NAME', type: 'string', fallbackValue: 'A tracked competitor' },
      { key: 'COMPETITOR_SCORE', type: 'number', fallbackValue: 0 },
      { key: 'SCORE_GAP', type: 'number', fallbackValue: 0 },
    ],
  },
  {
    alias: 'presora-lifecycle-payment-failed', name: 'Presora — payment failed', subject: 'Action needed: keep your Presora access active',
    html: shell(heading('Your work is safe.', 'We could not process the latest payment, but your scans and reports are still here.', '<p>Update your billing details to keep monitoring and reports running without interruption. Nothing needs to be recreated.</p>'), 'Keep my access active', 'https://www.presora.app/settings'),
  },
];

const unwrap = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};

const eventList = unwrap(await resend.events.list({ limit: 100 }), 'List events').data;
for (const [name, schema] of Object.entries(events)) {
  const existing = eventList.find((event) => event.name === name);
  if (existing) {
    unwrap(await resend.events.update(existing.id, { schema }), `Update event ${name}`);
    console.log(`Updated event: ${name}`);
  } else {
    unwrap(await resend.events.create({ name, schema }), `Create event ${name}`);
    console.log(`Created event: ${name}`);
  }
}

const templateList = unwrap(await resend.templates.list({ limit: 100 }), 'List templates').data;
const templateIds = {};
for (const template of templates) {
  const existing = templateList.find((item) => item.alias === template.alias || item.name === template.name);
  const variables = [
    { key: 'FIRST_NAME', type: 'string', fallbackValue: 'there' },
    ...(template.marketing ? [{ key: 'UNSUBSCRIBE_URL', type: 'string', fallbackValue: 'https://www.presora.app/settings' }] : []),
    ...(template.dynamicVariables || []),
  ];
  const { marketing: _marketing, dynamicVariables: _dynamicVariables, ...templatePayload } = template;
  const templateFrom = template.marketing ? marketingFrom : from;
  if (existing) {
    unwrap(await resend.templates.update(existing.id, { ...templatePayload, from: templateFrom, variables }), `Update ${template.alias}`);
    unwrap(await resend.templates.publish(existing.id), `Publish ${template.alias}`);
    templateIds[template.alias] = existing.id;
    console.log(`Updated template: ${template.alias}`);
    continue;
  }
  const created = unwrap(await resend.templates.create({ ...templatePayload, from: templateFrom, variables }), `Create ${template.alias}`);
  unwrap(await resend.templates.publish(created.id), `Publish ${template.alias}`);
  templateIds[template.alias] = created.id;
  console.log(`Created template: ${template.alias}`);
}

const email = (key, alias, marketing = false, variables = {}) => ({
  key,
  type: 'send_email',
  config: {
    from: marketing ? marketingFrom : from,
    ...(replyTo ? { replyTo } : {}),
    template: {
      id: templateIds[alias],
      variables: {
        FIRST_NAME: { var: 'first_name' },
        ...(marketing ? { UNSUBSCRIBE_URL: { var: 'unsubscribe_url' } } : {}),
        ...variables,
      },
    },
  },
});

const automations = [
  {
    name: 'Presora — account activation',
    steps: [
      { key: 'start', type: 'trigger', config: { eventName: 'presora.user.activated' } },
      email('welcome', 'presora-lifecycle-welcome'),
    ],
    connections: [{ from: 'start', to: 'welcome' }],
  },
  {
    name: 'Presora — first scan conversion',
    steps: [
      { key: 'start', type: 'trigger', config: { eventName: 'presora.nurture.started' } },
      { key: 'wait_scan_1', type: 'wait_for_event', config: { eventName: 'presora.analysis.completed', timeout: '1 day' } },
      email('first_scan', 'presora-lifecycle-first-scan', true),
      { key: 'wait_scan_2', type: 'wait_for_event', config: { eventName: 'presora.analysis.completed', timeout: '3 days' } },
      email('competitors', 'presora-lifecycle-competitors', true),
    ],
    connections: [
      { from: 'start', to: 'wait_scan_1' },
      { from: 'wait_scan_1', to: 'first_scan', type: 'timeout' },
      { from: 'first_scan', to: 'wait_scan_2' },
      { from: 'wait_scan_2', to: 'competitors', type: 'timeout' },
    ],
  },
  {
    name: 'Presora — scan result',
    steps: [
      { key: 'start', type: 'trigger', config: { eventName: 'presora.analysis.completed' } },
      email('scan_ready', 'presora-lifecycle-scan-ready'),
    ],
    connections: [{ from: 'start', to: 'scan_ready' }],
  },
  {
    name: 'Presora — scan to paid conversion',
    steps: [
      { key: 'start', type: 'trigger', config: { eventName: 'presora.analysis.nurture_started' } },
      { key: 'wait_paid_1', type: 'wait_for_event', config: { eventName: 'presora.subscription.started', timeout: '1 day' } },
      email('action', 'presora-lifecycle-action', true),
      { key: 'wait_paid_2', type: 'wait_for_event', config: { eventName: 'presora.subscription.started', timeout: '3 days' } },
      email('measure_again', 'presora-lifecycle-measure-again', true),
    ],
    connections: [
      { from: 'start', to: 'wait_paid_1' },
      { from: 'wait_paid_1', to: 'action', type: 'timeout' },
      { from: 'action', to: 'wait_paid_2' },
      { from: 'wait_paid_2', to: 'measure_again', type: 'timeout' },
    ],
  },
  {
    name: 'Presora — low score tailored quick win',
    steps: [
      { key: 'start', type: 'trigger', config: { eventName: 'presora.analysis.low_score' } },
      { key: 'wait_paid', type: 'wait_for_event', config: { eventName: 'presora.subscription.started', timeout: '3 days' } },
      email('quick_win', 'presora-lifecycle-low-score', true, {
        BRAND_NAME: { var: 'brand_name' },
        VISIBILITY_SCORE: { var: 'visibility_score' },
        WEAKEST_DIMENSION: { var: 'weakest_dimension' },
        QUICK_WIN: { var: 'quick_win' },
      }),
    ],
    connections: [
      { from: 'start', to: 'wait_paid' },
      { from: 'wait_paid', to: 'quick_win', type: 'timeout' },
    ],
  },
  {
    name: 'Presora — measured competitor gap urgency',
    steps: [
      { key: 'start', type: 'trigger', config: { eventName: 'presora.analysis.competitor_gap' } },
      { key: 'wait_paid', type: 'wait_for_event', config: { eventName: 'presora.subscription.started', timeout: '3 days' } },
      email('competitor_gap', 'presora-lifecycle-competitor-gap', true, {
        BRAND_NAME: { var: 'brand_name' },
        VISIBILITY_SCORE: { var: 'visibility_score' },
        WEAKEST_DIMENSION: { var: 'weakest_dimension' },
        QUICK_WIN: { var: 'quick_win' },
        COMPETITOR_NAME: { var: 'competitor_name' },
        COMPETITOR_SCORE: { var: 'competitor_score' },
        SCORE_GAP: { var: 'score_gap' },
      }),
    ],
    connections: [
      { from: 'start', to: 'wait_paid' },
      { from: 'wait_paid', to: 'competitor_gap', type: 'timeout' },
    ],
  },
  {
    name: 'Presora — failed payment recovery',
    steps: [
      { key: 'start', type: 'trigger', config: { eventName: 'presora.payment.failed' } },
      email('payment_failed', 'presora-lifecycle-payment-failed'),
    ],
    connections: [{ from: 'start', to: 'payment_failed' }],
  },
];

const automationList = unwrap(await resend.automations.list({ limit: 100 }), 'List automations').data;
for (const automation of automations) {
  const existing = automationList.find((item) => item.name === automation.name);
  if (existing) {
    unwrap(await resend.automations.update(existing.id, {
      ...automation,
      status: enabled ? 'enabled' : existing.status,
    }), `Update ${automation.name}`);
    console.log(`Updated automation: ${automation.name}`);
    continue;
  }
  unwrap(await resend.automations.create({ ...automation, status: enabled ? 'enabled' : 'disabled' }), `Create ${automation.name}`);
  console.log(`Created automation: ${automation.name} (${enabled ? 'enabled' : 'disabled'})`);
}

console.log(`Resend lifecycle setup complete. Automations are ${enabled ? 'enabled' : 'disabled for review'}.`);
