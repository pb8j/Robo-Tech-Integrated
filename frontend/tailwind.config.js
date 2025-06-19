/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Roboto Condensed"', 'sans-serif'],
      },
      colors: {
        robotDark: '#1a237e',     // Dark blue
        robotLight: '#00b0ff',    // Light blue
        robotAccent: '#ffab00',   // Yellow accent
        robotGray: '#f8fafc'      // Light background
      },
    },
  },
  plugins: [],
}