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
        
        // Material Design 3 - Semantic Containers & Surfaces
        'primary-container': 'var(--color-primary-container)',
        'on-primary-container': 'var(--color-on-primary-container)',
        'secondary-container': 'var(--color-secondary-container)',
        'on-secondary-container': 'var(--color-on-secondary-container)',
        'surface-container-low': 'var(--color-surface-container-low)',
        'surface-container': 'var(--color-surface-container)',
        'surface-container-high': 'var(--color-surface-container-high)',
        'surface-container-highest': 'var(--color-surface-container-highest)',
        'outline': 'var(--color-outline)',
        'outline-variant': 'var(--color-outline-variant)',

        // Semantic Status Colors
        'error': 'var(--color-error)',
        'error-container': 'var(--color-error-container)',
        'warning': 'var(--color-warning)',
        'warning-container': 'var(--color-warning-container)',
        'success': 'var(--color-success)',
        'success-container': 'var(--color-success-container)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'DEFAULT': 'var(--radius-md)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        'full': 'var(--radius-full)',
      }
    },
  },
  plugins: [],
}