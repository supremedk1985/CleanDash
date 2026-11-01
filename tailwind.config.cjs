/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src-www/index.html", "./src-www/**/*.{vue,ts}"],
  // the page sets data-theme="dark" (sunrise/sunset or the setting), not a class
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: { extend: { fontFamily: { sans: ["Roboto", "system-ui", "sans-serif"] } } },
  plugins: [],
};
