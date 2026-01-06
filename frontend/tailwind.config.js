/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "#3b82f6",
                "primary-dark": "#2563eb",
                secondary: "#A1A1AA",
                accent: "#3b82f6",
                "background-light": "#f4f4f5",
                "background-dark": "#09090b",
                "app-bg": "#000000",
                "surface-light": "#ffffff",
                "surface-dark": "#18181b",
                "surface-highlight": "#18181b",
                "surface-card": "#121212",
                "border-dark": "#27272a",
                "text-secondary": "#a1a1aa",
                "text-tertiary": "#52525b",
                "status-success": "#10b981",
                "status-warning": "#f59e0b",
                "status-error": "#ef4444",
            },
            fontFamily: {
                display: ["Inter", "sans-serif"],
                sans: ["Inter", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            borderRadius: {
                DEFAULT: "0.25rem",
                lg: "0.5rem",
                xl: "0.75rem",
                "2xl": "1rem",
                full: "9999px",
            },
            animation: {
                "pulse-glow": "pulse-glow 2s ease-in-out infinite",
            },
            keyframes: {
                "pulse-glow": {
                    "0%, 100%": { boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)" },
                    "50%": { boxShadow: "0 0 40px rgba(59, 130, 246, 0.6)" },
                },
            },
        },
    },
    plugins: [],
}
