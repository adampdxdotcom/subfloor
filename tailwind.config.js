/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./types.ts",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)', // New utility
        'on-primary': 'var(--color-on-primary)',       // Smart Contrast Text
        'secondary': 'var(--color-secondary)',
        'secondary-hover': 'var(--color-secondary-hover)', // New utility
        'on-secondary': 'var(--color-on-secondary)',       // Smart Contrast Text
        'accent': 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)', // New utility
        'on-accent': 'var(--color-on-accent)',             // Smart Contrast Text
        'background': 'var(--color-background)',
        'surface': 'var(--color-surface)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'border': 'var(--color-border)',
      }
    },
  },
  plugins: [],
}