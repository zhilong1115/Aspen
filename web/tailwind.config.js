/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        google: {
          blue: '#1a73e8',
          red: '#ea4335',
          yellow: '#fbbc04',
          green: '#34a853',
          gray: {
            50: '#f8f9fa',
            100: '#f1f3f4',
            300: '#dadce0',
            500: '#9aa0a6',
            700: '#5f6368',
            800: '#3c4043',
            900: '#202124',
          },
        },
      },
      boxShadow: {
        'card': '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
        'card-hover': '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
      },
      fontFamily: {
        sans: ['"Google Sans"', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
