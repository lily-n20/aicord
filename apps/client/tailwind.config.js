/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#1e1f22',
        'bg-secondary': '#2b2d31',
        'bg-tertiary': '#313338',
        'bg-modifier': '#404249',
        'text-normal': '#dbdee1',
        'text-muted': '#80848e',
        'text-link': '#00a8fc',
        'brand': '#5865f2',
        'brand-hover': '#4752c4',
        'success': '#23a55a',
        'danger': '#f23f43',
        'warning': '#f0b132',
      },
    },
  },
  plugins: [],
}
