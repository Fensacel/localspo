/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#030712',
          surface: '#0F172A',
          card: 'rgba(17,24,39,0.65)',
        },
        primary: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
          light: '#60A5FA',
          glow: '#93C5FD',
        },
        accent: '#60A5FA',
        text: {
          DEFAULT: '#F8FAFC',
          secondary: '#94A3B8',
          muted: '#64748B',
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(59,130,246,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(59,130,246,0.6)' },
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
        glow: '0 0 20px rgba(59,130,246,0.3)',
        'glow-lg': '0 0 40px rgba(59,130,246,0.4)',
        'glow-xl': '0 0 60px rgba(59,130,246,0.5)',
        glass: '0 8px 32px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
};
