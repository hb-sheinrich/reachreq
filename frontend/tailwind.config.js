/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        text: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          fg: 'var(--accent-fg)',
        },
        link: 'var(--link)',
        focus: 'var(--focus)',
        status: {
          draft: { fg: 'var(--status-draft-fg)', bg: 'var(--status-draft-bg)' },
          'in-review': { fg: 'var(--status-in-review-fg)', bg: 'var(--status-in-review-bg)' },
          submitted: { fg: 'var(--status-submitted-fg)', bg: 'var(--status-submitted-bg)' },
          approved: { fg: 'var(--status-approved-fg)', bg: 'var(--status-approved-bg)' },
          rejected: { fg: 'var(--status-rejected-fg)', bg: 'var(--status-rejected-bg)' },
          postponed: { fg: 'var(--status-postponed-fg)', bg: 'var(--status-postponed-bg)' },
          archived: { fg: 'var(--status-archived-fg)', bg: 'var(--status-archived-bg)' },
        },
        classification: {
          must: { fg: 'var(--classification-must-fg)', bg: 'var(--classification-must-bg)' },
          should: { fg: 'var(--classification-should-fg)', bg: 'var(--classification-should-bg)' },
          could: { fg: 'var(--classification-could-fg)', bg: 'var(--classification-could-bg)' },
          nice: { fg: 'var(--classification-nice-fg)', bg: 'var(--classification-nice-bg)' },
          wont: { fg: 'var(--classification-wont-fg)', bg: 'var(--classification-wont-bg)' },
        },
        glossary: {
          defined: 'var(--glossary-defined)',
          alias: 'var(--glossary-alias)',
        },
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        id: 'var(--fs-id)',
        h1: 'var(--fs-h1)',
        h2: 'var(--fs-h2)',
        body: 'var(--fs-body)',
        sm: 'var(--fs-sm)',
        label: 'var(--fs-label)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        field: 'var(--radius-field)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
      transitionDuration: {
        dur: 'var(--dur)',
      },
      transitionTimingFunction: {
        ease: 'var(--ease)',
      },
    },
  },
  plugins: [],
}
