import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f2f6fc',
          100: '#e4ecf7',
          200: '#c5d7ef',
          300: '#94b6e2',
          400: '#5b8fd1',
          500: '#3670bd',
          600: '#2859a0',
          700: '#214883',
          800: '#1f3e6c',
          900: '#0d1b33',
          950: '#060d1d',
        },
        brand: {
          50: '#effcf6',
          100: '#d7f8ea',
          200: '#b0f0d6',
          300: '#75e2bb',
          400: '#38cc9a',
          500: '#10b282',
          600: '#078f6a',
          700: '#087257',
          800: '#0a5b47',
          900: '#0a4b3c',
          950: '#032b21',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(10, 18, 40, 0.06), 0 8px 24px -8px rgba(10, 18, 40, 0.10)',
        glow: '0 0 40px -8px rgba(16, 178, 130, 0.45)',
        'glow-lg': '0 0 80px -16px rgba(16, 178, 130, 0.55)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) rotate(-2deg)' },
          '50%': { transform: 'translateY(-10px) rotate(2deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-600px 0' },
          '100%': { backgroundPosition: '600px 0' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        ping: {
          '75%, 100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 9s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        'spin-slow': 'spin-slow 14s linear infinite',
        ping: 'ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
