/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0f172a',
        'dark-card': '#1e293b',
        'accent-blue': '#3b82f6',
        'critical-red': '#ef4444',
        'warn-amber': '#f59e0b',
        'safe-green': '#10b981',
      },
    },
  },
  plugins: [],
}
