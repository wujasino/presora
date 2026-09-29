/* Shared FAQ content — surfaced on the landing page and the app home.
   Written for a non-technical reader: no "prompts", "foundation models",
   "pipelines" or version numbers. Where a term is unavoidable (API), it's
   explained in the same sentence. */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_EN: FaqItem[] = [
  {
    q: 'What does Presora actually do?',
    a: 'We ask the AI assistants your customers use — ChatGPT, Claude, Gemini and others — which brands they recommend in your category. Presora compares you with those competitors, explains the signals behind the gap, and ranks the actions most likely to close it.',
  },
  {
    q: 'What is Generative Engine Optimization (GEO)?',
    a: 'GEO is the AI-era equivalent of SEO: instead of optimizing to rank on a search results page, you\'re optimizing to be the brand an AI assistant actually recommends when someone asks about your category. ChatGPT, Claude and Gemini answer from their own knowledge, not from a list of links — so being "findable" now also means being the answer, not just a result.',
  },
  {
    q: 'My SEO is already strong — why should I care about Perplexity or Claude?',
    a: 'A good Google ranking doesn\'t automatically carry over. AI assistants answer from their training data (and, for some, live web browsing), not from your search position — so a brand that\'s invisible to an AI model can rank #1 on Google, and the reverse happens too. More people are asking AI assistants directly instead of searching, so this is a separate, growing channel worth checking on its own.',
  },
  {
    q: 'How often is AI models\' knowledge updated?',
    a: 'It depends on the provider and isn\'t something Presora controls — each AI company retrains its own model on its own schedule, and some also browse the live web for current information. That\'s exactly why we recommend re-scanning periodically: your score reflects what each assistant knows right now, and that can shift whenever a model updates.',
  },
  {
    q: 'Which AI assistants do you check?',
    a: 'The free plan checks ChatGPT. Starter and Solo add Claude and Gemini. Business checks all six, including Perplexity. Larger companies can ask us to add their own.',
  },
  {
    q: 'How long does it take?',
    a: 'About 15 seconds. We ask every assistant at the same time, and you can watch their answers come in.',
  },
  {
    q: 'How reliable is the score?',
    a: 'The score combines five things we measure, checked against more than 200 well-known brands. Every answer counts toward the total, so one unusual reply can\'t throw your score off.',
  },
  {
    q: 'Can I compare myself to competitors?',
    a: 'Yes — on the Growth and Agency plans you can add up to 10 competitors and see them next to your own brand, checked the same way and on the same schedule.',
  },
  {
    q: 'Can I connect Presora to my own tools?',
    a: 'Yes. From the Developers page you can create a key that lets your own software pull results automatically, and get notified the moment a scan finishes or your score changes. Setup instructions are included.',
  },
  {
    q: 'How is my data handled?',
    a: 'Anything you tell us about your brand stays private to your account. We never use it to train AI models, and never share it with anyone beyond the AI providers needed to run your scan. Fully GDPR compliant.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — no contracts, no lock-in. Cancel in one click from Settings, and you keep access until the end of the period you\'ve paid for.',
  },
];
