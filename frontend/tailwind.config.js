/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"SF Pro Display"', '"SF Pro Text"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        apple: {
          blue: '#0071e3',
          blueHover: '#0077ed',
          dark: '#1d1d1f',
          gray: '#86868b',
          lightBg: '#f5f5f7',
        }
      },
      boxShadow: {
        'apple': '0 4px 30px rgba(0, 0, 0, 0.08)',
        'apple-hover': '0 10px 40px rgba(0, 0, 0, 0.12)',
      }
    },
  },
  plugins: [],
}