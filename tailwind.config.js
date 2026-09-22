/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      aspectRatio: {
        '9/16': '9 / 16',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        wall: {
          bg: '#0a0d14',
          card: '#121722',
          border: '#1f2937',
          accent: '#3b82f6',
        }
      }
    },
  },
  plugins: [],
}
