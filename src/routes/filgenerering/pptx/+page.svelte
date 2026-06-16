<script lang="ts">
    import { page } from "$app/state";

	let previewUrl = '/filgenerering/pptx/reveal?t=' + Date.now();

	function refreshPreview() {
		previewUrl = '/filgenerering/pptx/reveal?t=' + Date.now();
	}
</script>

<main>
	<h1>Presentasjon</h1>
	<div class="actions">
	
		<a href="/filgenerering/pptx/reveal/download-pptx" target="_blank">
			<button>
				Last ned PowerPoint
			</button>
		</a>
	</div>
	<iframe
		src={previewUrl}
		title="Reveal.js preview"
	></iframe>
</main>

<style>
	main {
		max-width: 1000px;
		margin: 2rem auto;
		font-family: system-ui, sans-serif;
	}
		.actions {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	button {
		padding: 0.7rem 1rem;
		cursor: pointer;
	}

	iframe {
		width: 100%;
		height: 600px;
		border: 1px solid #ccc;
		border-radius: 8px;
	}
</style>