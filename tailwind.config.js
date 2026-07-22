/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#09090b',
          surface: '#18181b',
          card: 'rgba(24,24,27,0.65)',
        },
        primary: {
          DEFAULT: '#ffffff',
          hover: '#e4e4e7',
          light: '#f4f4f5',
          glow: 'rgba(255,255,255,0.4)',
        },
        accent: '#ffffff',
        text: {
          DEFAULT: '#F8FAFC',
          secondary: '#a1a1aa',
          muted: '#71717a',
        },
        border: 'rgba(255,255,255,0.08)',
        danger: '#EF4444',
        success: '#22C55E',
        warning: '#FACC15',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '24px',
        button: '16px',
        cover: '32px',
      },
      backdropBlur: {
        glass: '30px',
        heavy: '80px',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255,255,255,0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(255,255,255,0.25)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(255,255,255,0.1)',
        'glow-lg': '0 0 40px rgba(255,255,255,0.15)',
        'glow-xl': '0 0 60px rgba(255,255,255,0.2)',
        glass: '0 8px 32px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};

