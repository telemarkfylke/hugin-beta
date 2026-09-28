<script lang="ts">
	type Props = {
		name: string
		avatarUrl?: string | undefined
		statusText: string
		onNewChat: () => void
	}
	let { name, avatarUrl, statusText, onNewChat }: Props = $props()

	let menuOpen = $state(false)

	let initials = $derived.by(() => {
		const trimmed = name.trim()
		if (!trimmed) return "?"
		const parts = trimmed.split(/\s+/)
		const first = parts[0]?.[0] ?? ""
		const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
		return (first + last).toUpperCase()
	})

	const toggleMenu = (): void => {
		menuOpen = !menuOpen
	}

	const handleNewChat = (): void => {
		menuOpen = false
		onNewChat()
	}

	const closeOnOutsideClick = (event: MouseEvent): void => {
		if (menuOpen && !(event.target instanceof HTMLElement && event.target.closest(".embed-header-menu"))) {
			menuOpen = false
		}
	}

	const closeOnEscape = (event: KeyboardEvent): void => {
		if (event.key === "Escape") menuOpen = false
	}
</script>

<svelte:window onclick={closeOnOutsideClick} onkeydown={closeOnEscape} />

<header class="embed-header">
	<div class="embed-header-avatar" aria-hidden="true">
		{#if avatarUrl}
			<img src={avatarUrl} alt="" />
		{:else}
			<span class="embed-header-initials">{initials}</span>
		{/if}
	</div>
	<div class="embed-header-text">
		<span class="embed-header-name">{name}</span>
		<span class="embed-header-status">{statusText}</span>
	</div>
	<div class="embed-header-menu">
		<button class="icon-button" onclick={toggleMenu} title="Meny" aria-haspopup="true" aria-expanded={menuOpen} aria-label="Åpne meny" type="button">
			<span class="material-symbols-outlined">more_vert</span>
		</button>
		{#if menuOpen}
			<div class="embed-header-menu-list" role="menu">
				<button role="menuitem" onclick={handleNewChat} type="button">Ny samtale</button>
			</div>
		{/if}
	</div>
</header>

<style>
	.embed-header {
		box-sizing: border-box;
		height: var(--embed-header-height);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0 1rem;
		background: var(--embed-surface);
		border-bottom: 1px solid var(--embed-border);
	}

	.embed-header-avatar {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-primary);
	}

	.embed-header-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.embed-header-initials {
		color: var(--embed-accent-fg, #ffffff);
		font-weight: 700;
		font-size: 0.9rem;
	}

	.embed-header-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}

	.embed-header-name {
		font-weight: 700;
		color: var(--embed-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.embed-header-status {
		font-size: 0.78rem;
		color: var(--embed-muted-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.embed-header-menu {
		position: relative;
		flex-shrink: 0;
	}

	.embed-header-menu-list {
		position: absolute;
		right: 0;
		top: calc(100% + 0.25rem);
		background: var(--embed-surface);
		border: 1px solid var(--embed-border);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
		min-width: 9rem;
		z-index: 1;
		overflow: hidden;
	}

	.embed-header-menu-list button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.6rem 0.85rem;
		background: none;
		border: none;
		color: var(--embed-text);
		cursor: pointer;
	}

	.embed-header-menu-list button:hover {
		background: var(--embed-user-bubble-bg);
	}
</style>
