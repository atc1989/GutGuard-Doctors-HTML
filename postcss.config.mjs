// Tailwind only touches CSS that imports it (styles/admin.css); the site's globals.css passes through.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
