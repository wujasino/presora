// Runs in its own fresh Node process (spawned by
// newsletter-preference.spec.ts) so the module-load-time env var guard gets
// a genuinely clean evaluation, including all transitive dependencies.
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const mod = await import(new URL('../../../netlify/functions/newsletter-preference.js', import.meta.url));
const handler = mod.handler ?? mod.default?.handler;

const result = await handler({
  httpMethod: 'GET',
  headers: { authorization: 'Bearer fake-token' },
  body: '',
  queryStringParameters: {},
});

process.stdout.write(JSON.stringify(result));
