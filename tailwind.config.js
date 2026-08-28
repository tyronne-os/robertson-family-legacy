/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        script: ['"Pinyon Script"', 'cursive'],
        display: ['"Cinzel"', 'Georgia', 'serif'],
        body: ['"EB Garamond"', 'Georgia', 'serif'],
      },
      colors: {
        ink: '#1B120C',
        roomBlack: '#0B0705',
        leatherDeep: '#26150A',
        leatherWarm: '#4A2E16',
        gold: '#C9A227',
        goldHighlight: '#F0D98C',
        goldMid: '#E8C55C',
        goldShadow: '#8A6A1F',
        parchmentLight: '#F4E9D4',
        parchmentAged: '#E2CFAC',
        candleAmber: '#FFB765',
        rose: '#C98A78',
      },
    },
  },
  plugins: [],
}
