import {
  MONITORING_ASSISTANT_MODEL,
  MONITORING_ASSISTANT_SYSTEM_PROMPT,
  MONITORING_ASSISTANT_TOOLS,
} from '../netlify/functions/chat.js';

const cases = [
  {
    id: 'set-brand',
    prompt: 'Monitor Northstar Labs as my brand.',
    expected: [{ name: 'set_brand', input: { brand: 'Northstar Labs' } }],
  },
  {
    id: 'set-brand-polish',
    prompt: 'Ustaw Acme jako markę, którą mam monitorować.',
    expected: [{ name: 'set_brand', input: { brand: 'Acme' } }],
  },
  {
    id: 'add-competitor',
    prompt: 'Add Atlas as a competitor to track.',
    expected: [{ name: 'add_competitor', input: { name: 'Atlas' } }],
  },
  {
    id: 'add-competitor-polish',
    prompt: 'Dodaj Contoso do obserwowanych konkurentów.',
    expected: [{ name: 'add_competitor', input: { name: 'Contoso' } }],
  },
  {
    id: 'remove-competitor',
    prompt: 'Stop tracking Atlas as a competitor.',
    expected: [{ name: 'remove_competitor', input: { name: 'Atlas' } }],
  },
  {
    id: 'daily-schedule',
    prompt: 'Run my monitoring every day.',
    expected: [{ name: 'set_schedule', input: { frequency: 'daily' } }],
  },
  {
    id: 'weekly-schedule',
    prompt: 'Set my scan schedule to weekly.',
    expected: [{ name: 'set_schedule', input: { frequency: 'weekly' } }],
  },
  {
    id: 'monthly-schedule',
    prompt: 'Change monitoring to once a month.',
    expected: [{ name: 'set_schedule', input: { frequency: 'monthly' } }],
  },
  {
    id: 'sentiment-alert',
    prompt: 'Alert me if sentiment drops below 42.',
    expected: [{ name: 'set_alert', input: { metric: 'sentiment', threshold: 42 } }],
  },
  {
    id: 'visibility-alert',
    prompt: 'Notify me if visibility falls below 35.',
    expected: [{ name: 'set_alert', input: { metric: 'visibility', threshold: 35 } }],
  },
  {
    id: 'mentions-alert',
    prompt: 'Set an alert for mentions under 70.',
    expected: [{ name: 'set_alert', input: { metric: 'mentions', threshold: 70 } }],
  },
  {
    id: 'default-alert-threshold',
    prompt: 'Set an alert when sentiment drops.',
    expected: [{ name: 'set_alert', input: { metric: 'sentiment', threshold: 60 } }],
  },
  {
    id: 'clear-alert',
    prompt: 'Clear my visibility alert.',
    expected: [{ name: 'set_alert', input: { metric: null } }],
  },
  {
    id: 'select-one-model',
    prompt: 'Use Claude as the only model for my monitoring.',
    expected: [{ name: 'select_models', input: { models: ['claude'] } }],
  },
  {
    id: 'select-multiple-models',
    prompt: 'Use GPT-4o and Gemini for my scans.',
    expected: [{ name: 'select_models', input: { models: ['gpt-4o', 'gemini'] } }],
  },
  {
    id: 'combined-monitoring-changes',
    prompt: 'Monitor Northstar Labs, add Atlas as a competitor, and scan weekly.',
    expected: [
      { name: 'set_brand', input: { brand: 'Northstar Labs' } },
      { name: 'add_competitor', input: { name: 'Atlas' } },
      { name: 'set_schedule', input: { frequency: 'weekly' } },
    ],
  },
  {
    id: 'brand-and-model-change',
    prompt: 'Track Acme and use only Gemini.',
    expected: [
      { name: 'set_brand', input: { brand: 'Acme' } },
      { name: 'select_models', input: { models: ['gemini'] } },
    ],
  },
  {
    id: 'read-current-configuration',
    prompt: 'What monitoring schedule and alert settings do I have?',
    expected: [{ name: 'get_config', input: {} }],
  },
  {
    id: 'do-not-run-scan',
    prompt: 'Run a brand visibility scan for me right now.',
    expected: [],
  },
  {
    id: 'out-of-scope-billing',
    prompt: 'Change my subscription to the annual plan.',
    expected: [],
  },
];

const writeTools = new Set([
  'set_brand',
  'add_competitor',
  'remove_competitor',
  'set_schedule',
  'set_alert',
  'select_models',
]);

function matchesExpectedInput(actual, expected) {
  return Object.entries(expected).every(([key, value]) => (
    JSON.stringify(actual?.[key]) === JSON.stringify(value)
  ));
}

function scoreCalls(actualCalls, expectedCalls) {
  const unmatched = [...actualCalls];
  const missing = expectedCalls.filter((expected) => {
    const index = unmatched.findIndex((actual) => (
      actual.name === expected.name && matchesExpectedInput(actual.input, expected.input)
    ));
    if (index === -1) return true;
    unmatched.splice(index, 1);
    return false;
  });
  const unexpected = unmatched.filter((call) => (
    expectedCalls.length === 0 || writeTools.has(call.name) || call.name !== 'get_config'
  ));

  return { passed: missing.length === 0 && unexpected.length === 0, missing, unexpected };
}

async function evaluateCase(testCase, apiKey) {
  const messages = [{ role: 'user', content: testCase.prompt }];
  const calls = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MONITORING_ASSISTANT_MODEL,
        max_tokens: 256,
        system: MONITORING_ASSISTANT_SYSTEM_PROMPT,
        tools: MONITORING_ASSISTANT_TOOLS,
        messages,
      }),
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 300);
      throw new Error(`Anthropic request failed (${response.status}): ${details}`);
    }

    const result = await response.json();
    inputTokens += result.usage?.input_tokens || 0;
    outputTokens += result.usage?.output_tokens || 0;
    const content = Array.isArray(result.content) ? result.content : [];
    const toolCalls = content.filter((block) => block.type === 'tool_use');
    calls.push(...toolCalls.map(({ name, input }) => ({ name, input })));

    if (result.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content });
    messages.push({
      role: 'user',
      content: toolCalls.map((call) => ({
        type: 'tool_result',
        tool_use_id: call.id,
        content: JSON.stringify(
          call.name === 'get_config'
            ? { brand: 'Northstar Labs', schedule: 'weekly', alert: null }
            : { staged: true },
        ),
      })),
    });
  }

  return {
    ...scoreCalls(calls, testCase.expected),
    calls,
    inputTokens,
    outputTokens,
  };
}

async function main() {
  if (!process.argv.includes('--confirm-cost')) {
    throw new Error('This evaluation makes paid Anthropic API requests. Re-run with --confirm-cost to continue.');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required.');

  let passed = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const testCase of cases) {
    const result = await evaluateCase(testCase, apiKey);
    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;
    if (result.passed) passed += 1;
    const called = result.calls.map(({ name }) => name).join(', ') || '(none)';
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${testCase.id} — ${called}`);
    for (const missing of result.missing) {
      console.log(`  Missing: ${missing.name} ${JSON.stringify(missing.input)}`);
    }
    for (const unexpected of result.unexpected) {
      console.log(`  Unexpected: ${unexpected.name} ${JSON.stringify(unexpected.input)}`);
    }
  }

  console.log(`\nResult: ${passed}/${cases.length} passed`);
  console.log(`Anthropic usage: ${inputTokens} input tokens, ${outputTokens} output tokens (not persisted)`);
  if (passed !== cases.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
