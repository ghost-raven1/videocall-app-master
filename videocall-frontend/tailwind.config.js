/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
      colors: {
        primary: {
          50: '#0f1729',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        warp: {
          bg: '#050816',
          bgSoft: '#050816',
          surface: '#0b1020',
          surfaceAlt: '#111827',
          border: '#1f2937',
          accent: '#6366f1',
          accentSoft: '#4c1d95',
          accent2: '#22c55e',
          accent2Soft: '#064e3b',
          error: '#f97373',
          warning: '#facc15',
          text: '#e5e7eb',
          muted: '#9ca3af',
        },
      },
      boxShadow: {
        'warp-sm': '0 10px 30px rgba(15,23,42,0.8)',
        'warp-md': '0 18px 60px rgba(15,23,42,0.95)',
      },
      backgroundImage: {
        'warp-radial':
          'radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 55%), radial-gradient(circle at bottom right, rgba(129,140,248,0.24), transparent 55%)',
      },
      borderRadius: {
        warp: '18px',
      },
    },
  },
  plugins: [],
}

