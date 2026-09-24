export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#F7F4EF',
          50: '#FBFAF7',
          100: '#F7F4EF',
          200: '#EFE9E0',
        },
        charcoal: {
          DEFAULT: '#2A2A28',
          light: '#4B4B47',
          muted: '#8A8A82',
        },
        brand: {
          50: '#FEF4EA',
          100: '#FDE7D0',
          200: '#FBCB9E',
          300: '#F9AF6D',
          400: '#F7963F',
          500: '#F5811E',
          600: '#DC6A0C',
          700: '#B4530A',
          800: '#8A400A',
          900: '#663109',
        },
        peach: {
          DEFAULT: '#FCEBDD',
          light: '#FDF3EB',
        },
        sage: {
          DEFAULT: '#7FB998',
          light: '#E6F1EA',
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
        soft: '0 1px 2px rgba(42,42,40,0.04), 0 6px 20px rgba(42,42,40,0.05)',
        card: '0 2px 8px rgba(42,42,40,0.04), 0 12px 32px rgba(42,42,40,0.06)',
        lift: '0 8px 30px rgba(42,42,40,0.10)',
        glow: '0 8px 30px rgba(245,129,30,0.28)',
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