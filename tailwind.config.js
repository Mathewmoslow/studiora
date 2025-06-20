/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Add this line for dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'studiora-blue': '#2196F3',
        'studiora-purple': '#9C27B0',
        'studiora-green': '#4CAF50',
        'studiora-orange': '#FF9800',
      },
      fontFamily: {
        'studiora': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}