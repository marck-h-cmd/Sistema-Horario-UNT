import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        primary: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#1a365d',
          700: '#153050',
          800: '#102a43',
          900: '#0a1929',
          DEFAULT: '#1a365d',
          foreground: '#ffffff',
        },
        unt: {
          blue: {
            DEFAULT: '#1a365d',
            light: '#2c5282',
          },
          gold: {
            DEFAULT: '#c9a84c',
            light: '#e2c878',
          },
          red: '#c41e3a',
          gray: {
            DEFAULT: '#4a5568',
            light: '#718096',
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(26 54 93 / 0.06), 0 1px 2px -1px rgb(26 54 93 / 0.06)',
        header: '0 1px 0 0 rgb(226 232 240 / 1)',
      },
    },
  },
  plugins: [],
};

export default config;
