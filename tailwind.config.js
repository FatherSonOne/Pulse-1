/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'pulse-rose': '#f43f5e',
        'pulse-pink': '#ec4899',
        'pulse-coral': '#fb7185',
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        coral: {
          500: '#fb7185',
          600: '#f43f5e',
        }
      },
      boxShadow: {
        'rose-sm': '0 0 10px rgba(244, 63, 94, 0.15)',
        'rose-md': '0 0 20px rgba(244, 63, 94, 0.20)',
        'rose-lg': '0 0 30px rgba(244, 63, 94, 0.25)',
      },
      animation: {
        'pulse-glow-rose': 'pulse-glow-rose 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow-rose': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(244, 63, 94, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(244, 63, 94, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
