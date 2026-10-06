<script lang="ts">
	import { ROLE_PREVIEW_LABELS, type RolePreviewRole, setRolePreview } from "$lib/role-preview"

	type Props = {
		role: RolePreviewRole
	}
	let { role }: Props = $props()

	let ending = $state(false)

	const endPreview = async () => {
		ending = true
		try {
			await setRolePreview(null)
		} catch (error) {
			console.error("Error ending role preview:", error)
			alert("Kunne ikke avslutte rollevisning")
			ending = false
		}
	}
</script>

<!-- Rendered at the bottom of the Menu (see $lib/role-preview) - in normal flow, not as an overlay,
     so it never covers the page's own controls. -->
<div class="role-preview-banner" role="status">
	<div class="role-preview-text">
		<span class="material-symbols-rounded">visibility</span>
		<span>Du ser Hugin som <strong>{ROLE_PREVIEW_LABELS[role]}</strong></span>
	</div>
	<button onclick={endPreview} disabled={ending}>Avslutt</button>
</div>

<style>
	.role-preview-banner {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem 0.7rem;
		border-radius: 0.5rem;
		background-color: var(--color-primary);
		color: white;
		font-size: 0.85rem;
	}
	.role-preview-text {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.role-preview-text .material-symbols-rounded {
		font-size: 1.1rem;
	}
	.role-preview-banner button {
		align-self: flex-start;
		border: none;
		border-radius: 2rem;
		padding: 0.2rem 0.7rem;
		font-size: 0.8rem;
		background-color: white;
		color: var(--color-primary);
		cursor: pointer;
	}
</style>
