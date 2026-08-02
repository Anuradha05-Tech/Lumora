/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        background: '#212121',
        surface: '#2F2F2F',
        primary: '#3b82f6', // Copilot Blue Accent
        text: '#ECECEC',
        muted: '#B4B4B4'
      }
    },
  },
  plugins: [],
}
