<script lang="ts">
	import { canSeeSpotlight } from "$lib/authorization"
	import { SPOTLIGHTS } from "$lib/spotlights"
	import type { AppRoles } from "$lib/types/app-config"
	import type { AuthenticatedPrincipal } from "$lib/types/authentication"
	import FeatureSpotlight from "./FeatureSpotlight.svelte"

	type Props = {
		authenticatedUser: AuthenticatedPrincipal
		appRoles: AppRoles
	}
	let { authenticatedUser, appRoles }: Props = $props()
</script>

{#each SPOTLIGHTS as spotlight (spotlight.id)}
	<FeatureSpotlight
		id={spotlight.id}
		icon={spotlight.icon}
		header={spotlight.header}
		text={spotlight.text}
		subtext={spotlight.subtext}
		placement={spotlight.placement}
		backdrop={spotlight.backdrop}
		active={canSeeSpotlight(authenticatedUser, appRoles, spotlight.accessGroups ?? ["all"])}
	/>
{/each}
