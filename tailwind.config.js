/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        accent: {
          DEFAULT: '#00ff00',
          light: 'rgba(0, 255, 0, 0.1)',
          hover: 'rgba(0, 255, 0, 0.2)',
        },
      },
      backgroundColor: {
        dark: '#050505',
        darker: '#0a0a0a',
      },
    },
  },
  plugins: [],
}
