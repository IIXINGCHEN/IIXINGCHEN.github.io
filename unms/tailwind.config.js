/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Crucial for class-based dark mode
  content: [
    './index.html', // Assuming your HTML file is in the root
    // Add other paths if you have JS files that might contain Tailwind classes:
    // './src/**/*.{html,js}', 
  ],
  theme: {
    extend: {
      // You can add custom theme extensions here if needed in the future
    },
  },
  plugins: [
    // Add any Tailwind plugins you were using via CDN or want to use.
    // For example, if you need custom scrollbars via a plugin:
    // require('tailwind-scrollbar'), // Then you can use scrollbar-thin, scrollbar-thumb-gray-300 etc.
    // If not using a scrollbar plugin, the custom CSS for scrollbars in input.css is fine.
  ],
}
