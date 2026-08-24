// Витрина UI Kit (src/dev) существует только в dev-сборке, поэтому её классы
// выкидываются из production-CSS. В dev каталог сканируется как обычно, иначе
// сама витрина осталась бы без стилей.
const isProduction = globalThis.process?.env?.NODE_ENV === 'production'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    ...(isProduction ? ["!./src/dev/**"] : []),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
