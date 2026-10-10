export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        // Palette: 9ADBCC · C7F2D1 · E3FFD6 · FFFBF0 · D0F2F7 · 9EB2DB
        cream: {
          DEFAULT: '#FFFBF0',
          50: '#FFFDF8',
          100: '#FFFBF0',
          200: '#F1EEE2',
        },
        charcoal: {
          DEFAULT: '#252E48',
          light: '#46506E',
          muted: '#6F7895',
        },
        // Teal scale built around #9ADBCC (300); 500+ deepened for legible white text.
        brand: {
          50: '#EEFAF6',
          100: '#D9F3EC',
          200: '#BCE9DE',
          300: '#9ADBCC',
          400: '#5FC0AB',
          500: '#2E9C88',
          600: '#248270',
          700: '#1D695B',
          800: '#185449',
          900: '#13433B',
        },
        peach: {
          DEFAULT: '#C7F2D1',
          light: '#E3FFD6',
        },
        sage: {
          DEFAULT: '#8CCFA0',
          light: '#E3FFD6',
        },
        ice: {
          DEFAULT: '#D0F2F7',
          deep: '#7FCFDD',
        },
        periwinkle: {
          DEFAULT: '#9EB2DB',
          light: '#E4EAF6',
          deep: '#7F95CC',
          dark: '#1F2840',
        },
        amber: {
          soft: '#F2B857',
          light: '#FBEFD6',
        },
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '28px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(37,46,72,0.04), 0 6px 20px rgba(37,46,72,0.05)',
        card: '0 2px 8px rgba(37,46,72,0.04), 0 12px 32px rgba(37,46,72,0.06)',
        lift: '0 8px 30px rgba(37,46,72,0.10)',
        glow: '0 8px 30px rgba(46,156,136,0.28)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        hand: ['Caveat', 'cursive'],
      },
    },
  },
  plugins: [],
}