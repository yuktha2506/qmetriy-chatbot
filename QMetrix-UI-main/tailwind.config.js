import forms from '@tailwindcss/forms';
import aspectRatio from '@tailwindcss/aspect-ratio';
import preline from 'preline/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/*.html',
    './node_modules/preline/dist/*.js',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
      },
      transitionDuration: {
        400: '400ms',
        500: '500ms',
        600: '600ms',
        700: '700ms',
        800: '800ms',
        900: '900ms',
      },
      backgroundColor: {
        body: '#25293c',
        secondary: {
          100: '#d5d6db',
          200: '#acadb6',
          300: '#828592',
          400: '#595c6d',
          500: '#2f3349',
          600: '#25293c',
          700: '#1c1f2c',
          800: '#13141d',
          900: '#090a0f',
        },
        primary: {
          100: '#e3e1fc',
          200: '#c7c2f9',
          300: '#aba4f6',
          400: '#8f85f3',
          500: '#7367f0',
          600: '#5c52c0',
          700: '#453e90',
          800: '#2e2960',
          900: '#171530',
        },
        graph: {
          100: '#ff9f43', // orange
          200: '#ff9f4329', // bg orange
          300: '#ff4c51', // red
          400: '#ff4c5129', // bg red
          500: '#7367f0', // purple
          600: '#7367f029', // bg purple
          700: '#28c76f', // green
          800: '#28c76f29', // bg green
        },
      },
      colors: {
        container: 'rgba(225, 222, 245, 0.9)',
        bgColor: '#2F3349',
        'custom-gray': '#e1def5e6',
        'custom-blue': '#03c9d7',
        light: {
          100: '#ffffff',
        },
        graph: {
          100: '#ff9f43',
          200: '#ff9f4329',
          300: '#ff4c51',
          400: '#ff4c5129',
          500: '#7367f0',
          600: '#7367f029',
          700: '#28c76f',
          800: '#28c76f29',
        },
      },
      textColor: {
        'custom-gray': '#e1def5e6',
        'custom-black': '#000000',
        'custom-white': '#FFFFFF',
      },
      width: {
        wd: '80%',
        wd65: '65%',
        wd35: '35%',
      },
      margin: {
        mt15: '15%',
        left: '10%',
        left25: '25%',
        top10: '10%',
      },
    },
  },
  plugins: [
    forms,
    aspectRatio,
    preline,
    function ({ addBase, theme }) {
      addBase({
        body: {
          backgroundColor: theme('backgroundColor.body'),
          fontFamily: theme('fontFamily.sans'),
        },
      });
    },
  ],
};
