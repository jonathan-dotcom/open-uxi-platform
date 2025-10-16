import { fontFamily } from 'tailwindcss/defaultTheme';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#111c3d',
        accent: '#0ea5e9',
        success: '#22c55e',
        warning: '#facc15',
        danger: '#f87171'
      },
      fontFamily: {
        sans: ['"Inter"', ...fontFamily.sans]
      },
      boxShadow: {
        card: '0 16px 32px rgba(15, 23, 42, 0.25)'
      }
    }
  },
  plugins: []
};
