const THEME_KEY = "hugin-theme"

export type Theme = "light" | "dark"

function getInitialTheme(): Theme {
	if (typeof window === "undefined") return "light"

	const stored = localStorage.getItem(THEME_KEY)
	if (stored === "light" || stored === "dark") {
		return stored
	}

	// Check system preference
	if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
		return "dark"
	}

	return "light"
}

function createThemeState() {
	let current: Theme = $state("light")

	// Initialize on client side
	if (typeof window !== "undefined") {
		current = getInitialTheme()
		applyTheme(current)
	}

	function applyTheme(theme: Theme) {
		if (typeof document === "undefined") return

		// Enable transitions after initial load
		document.documentElement.classList.add("theme-transition")

		// Apply theme
		document.documentElement.setAttribute("data-theme", theme)

		// Disable transitions after a short delay to avoid flash on initial load
		setTimeout(() => {
			document.documentElement.classList.remove("theme-transition")
		}, 300)
	}

	function toggle() {
		current = current === "light" ? "dark" : "light"
		applyTheme(current)
		localStorage.setItem(THEME_KEY, current)
	}

	function setTheme(theme: Theme) {
		current = theme
		applyTheme(current)
		localStorage.setItem(THEME_KEY, current)
	}

	function initialize() {
		if (typeof window === "undefined") return
		current = getInitialTheme()
		// Apply without transition on init
		document.documentElement.setAttribute("data-theme", current)
	}

	return {
		get current() {
			return current
		},
		toggle,
		setTheme,
		initialize
	}
}

export const themeState = createThemeState()
