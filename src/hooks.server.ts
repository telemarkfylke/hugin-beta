import { sequence } from "@sveltejs/kit/hooks"
import { maintenance } from "$lib/server/hooks/maintenance"

// Order matters: maintenance goes first so it short-circuits everything after it.
export const handle = sequence(maintenance)
