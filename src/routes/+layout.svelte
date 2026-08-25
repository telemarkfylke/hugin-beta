<script lang="ts">
	import { onMount } from "svelte"
	import { invalidateAll } from "$app/navigation"
	import favicon16 from "$lib/assets/favicon-16x16.png"
	import favicon32 from "$lib/assets/favicon-32x32.png"
	import "../style.css" // Add global css (and make it hot reload)
	import "../lib/axe.js"
	import { isStudentOnly } from "$lib/authorization"
	import Menu from "$lib/components/Menu.svelte"
	import SpotlightHost from "$lib/components/SpotlightHost.svelte"
	import type { LayoutProps } from "./$types.js"

	let { children, data }: LayoutProps = $props()

	onMount(() => {
		const revalidateSession = () => {
			if (document.visibilityState === "visible") invalidateAll()
		}
		document.addEventListener("visibilitychange", revalidateSession)
		return () => document.removeEventListener("visibilitychange", revalidateSession)
	})
</script>

<svelte:head>
	<title>{data.APP_CONFIG.NAME}</title>
	<link rel="icon" type="image/png" sizes="32x32" href={favicon32}>
	<link rel="icon" type="image/png" sizes="16x16" href={favicon16}>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
	<style>
		@import url('https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,700&display=swap');
		@import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,700&display=swap');
		@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
	</style>
</svelte:head>

<main>
	<Menu
		authenticatedUser={data.authenticatedUser}
		appName={data.APP_CONFIG.NAME}
		isEmployee={data.authenticatedUser.roles.includes(data.APP_CONFIG.APP_ROLES.EMPLOYEE)}
		canvasEnabled={data.APP_CONFIG.CANVAS_ENABLED}
		isAdmin={data.authenticatedUser.roles.includes(data.APP_CONFIG.APP_ROLES.ADMIN)}
		isStudentOnly={isStudentOnly(data.authenticatedUser, data.APP_CONFIG.APP_ROLES)}
	/>
	<div class="page-content">
		{#if children}
			{@render children()}
		{:else}
			<p>fallback content</p>
		{/if}
	</div>
</main>

<SpotlightHost authenticatedUser={data.authenticatedUser} appRoles={data.APP_CONFIG.APP_ROLES} />

<style>
	main {
		box-sizing: border-box;
		height: 100%;
		display: flex;
	}
	.page-content {
		height: 100%;
		flex: 1;
	}
</style>