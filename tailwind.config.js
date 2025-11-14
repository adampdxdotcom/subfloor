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
        'primary': '#1e40af',
        'secondary': '#1d4ed8',
        'accent': '#3b82f6',
        'background': '#111827',
        'surface': '#1f2937',
        'text-primary': '#f9fafb',
        'text-secondary': '#d1d5db',
        'border': '#374151',
      }
    },
  },
  plugins: [],
}