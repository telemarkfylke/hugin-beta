import { browser, dev } from "$app/environment"

if (browser && dev) {
	import("axe-core").then((axe) => {
		axe
			.run()
			.then((results) => {
				if (results.violations.length) {
					console.warn("Accessibility Violations:", results.violations)
				}
			})
			.catch((err) => {
				console.error("Error running axe-core:", err)
			})
	})
}
