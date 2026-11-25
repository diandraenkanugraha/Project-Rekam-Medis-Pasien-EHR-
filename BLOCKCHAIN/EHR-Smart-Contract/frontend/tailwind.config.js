/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: { ink: { 900: '#0b2236', 700: '#27425a', 500: '#5b7387', 300: '#a5b6c4' } },
      boxShadow: {
        glass: '0 10px 40px -12px rgba(14,116,144,.20), inset 0 1px 0 rgba(255,255,255,.9)',
        lift: '0 20px 50px -14px rgba(14,116,144,.30)',
      },
    },
  },
  plugins: [],
}
