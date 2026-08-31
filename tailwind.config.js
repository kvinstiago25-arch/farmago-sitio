/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './script.js'],
  theme: {
    extend: {
      colors: {
        ink: '#1F2933',
        orange: '#C48A3A',
        'orange-dark': '#B7791F',
        'orange-light': '#F5E7CE',
        blue: '#102A43',
        'blue-dark': '#0B1F3A',
        'blue-light': '#E8EDF3',
        paper: '#FFFFFF',
        cloud: '#F5F7FA',
        navy: '#0B1F3A',
        'navy-mid': '#102A43',
        'navy-soft': '#16324F',
        copper: '#C48A3A',
        'copper-dark': '#B7791F',
        gold: '#D4A017',
        graphite: '#1F2933',
        whatsapp: '#25D366',
        danger: '#DC2626',
        warn: '#D97706',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
};
