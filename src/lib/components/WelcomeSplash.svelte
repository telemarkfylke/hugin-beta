<script lang="ts">
	type Props = {
		show: boolean
	}

	let { show = $bindable() }: Props = $props()
</script>

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="splash-backdrop" onclick={() => (show = false)}>
		<div class="splash" onclick={(e) => e.stopPropagation()}>
			<div class="splash-logo">
				<span class="material-symbols-rounded">smart_toy</span>
			</div>
			<div class="splash-text">
				<h1>Velkommen til Hugin 2.0</h1>
				<p>Din fylkeskommunale KI-assistent</p>
			</div>
			<button class="filled" onclick={() => (show = false)}>Kom i gang</button>
		</div>
	</div>
{/if}

<style>
	.splash-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		backdrop-filter: blur(2px);
	}

	.splash {
		background: white;
		border-radius: 12px;
		padding: 2.5rem 2rem;
		max-width: 28rem;
		width: 90%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
		text-align: center;
	}

	.splash-logo {
		width: 4rem;
		height: 4rem;
		border-radius: 50%;
		background-color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.splash-logo span {
		font-size: 2rem;
		color: white;
	}

	.splash-text {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.splash-text h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary);
		line-height: 1.2;
	}

	.splash-text p {
		margin: 0;
		font-size: 1rem;
		font-weight: 300;
		color: #444;
	}

	button.filled {
		margin-top: 0.5rem;
		padding: 0 1.5rem;
		height: 2.5rem;
		font-size: 1rem;
	}
</style>
