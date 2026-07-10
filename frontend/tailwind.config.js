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
