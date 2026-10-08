import type { EntraAccessGroup, RoleAccessGroups } from "$lib/types/chat"

// Mirrors FeatureSpotlight.svelte's FixedPlacement union. Duplicated rather than imported
// from the .svelte file - no existing precedent in this codebase for importing types out
// of .svelte files, and the union is small enough that duplicating it is lower-risk than
// introducing that pattern for one refactor.
export type SpotlightPlacement = "center" | "top-center" | "top-right" | "bottom-right" | "bottom-center" | "bottom-left" | "top-left"

// One entry per announcement. Anchored positioning (anchor/anchorSide/anchorOffset on
// FeatureSpotlight) is deliberately NOT represented here: an anchor is a live HTMLElement
// obtained via bind:this inside whatever component owns the UI being pointed at, which
// can't be expressed in a static data array. An anchored announcement should still be
// rendered directly as a <FeatureSpotlight anchor={...}> at its own call site (see
// README's "Anchored example") - this registry only covers the fixed-placement case.
export type SpotlightDefinition = {
	/** Unique, stable key used for dismissal tracking. Change it whenever header/text
	 *  copy changes so users who dismissed the old copy see the new one - never reuse an
	 *  id for different content. */
	id: string
	icon?: string
	header: string
	text: string
	subtext?: string
	placement?: SpotlightPlacement
	backdrop?: boolean
	/** CSS length, e.g. "32rem" for long copy. Defaults to "20rem". */
	width?: string
	/** Same semantics as ChatConfig.accessGroups / canPromptConfig. Omit for everyone
	 *  (SpotlightHost defaults to ["all"]) - ADMIN always sees it regardless. */
	accessGroups?: (RoleAccessGroups | EntraAccessGroup)[]
}

export const SPOTLIGHTS: SpotlightDefinition[] = [
	{
	  id: "Historikk-elev-1",
	  icon: "auto_awesome",
	  header: "Historikk i Hugin",
	  text: `Hugin husker nå samtalene du har med den. 🎉

		Samtaler lagres automatisk. Du kan slette gamle samtaler eller gjenoppta en samtale under <span class="spotlight-pill"><span class="material-symbols-rounded">history</span>Samtaler</span> i toppmenyen.

		Hvis du ikke ønsker å lagre samtaler, skrur du på <span class="spotlight-pill">Inkognito</span>-modus.`,
	  placement: "top-center",
	  backdrop: true,
	  accessGroups: ["student"],
	},
	{
		id: "simple-models-1",
		icon: "auto_awesome",
		width: "32rem",
		header: "Enklere modellvalg",
		text: `Nå er det enklere å velge. 🎉

		KI utvikler seg i rasende fart.	Nå kan du velge om KI-modellen skal være:

		<span class="spotlight-pill"><span class="material-symbols-rounded">bolt</span>Rask</span> - Raske svar på enkle oppgaver
		<span class="spotlight-pill"><span class="material-symbols-rounded">psychology</span>Grundig</span> - Analyse, resonnering og lange dokumenter
		<span class="spotlight-pill"><span class="material-symbols-rounded">shield</span>Europeisk</span> - Data behandles innenfor EU`,
		placement: "top-center",
		backdrop: true,
		accessGroups: ["employee", "edu_employee"]
	}
]
