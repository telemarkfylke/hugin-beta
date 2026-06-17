<script>
    import GrowingTextArea from '$lib/components/GrowingTextArea.svelte';
    import { page } from "$app/state";

	let previewUrl = $state('/filgenerering/pptx/reveal?t=' + Date.now());

	function refreshPreview() {
		previewUrl = '/filgenerering/pptx/reveal?t=' + Date.now();
	}

    let prompt = $state('');
    let loading = $state(false);

    async function handleSubmit() {
        if (!prompt.trim() || loading) return;
        loading = true;
        // TODO: kall backend her
        loading = false;
    }

    function handleKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }
</script>

<main>

    <div class="reveal_container">
        <h1>Presentasjon</h1>
        <div class="actions">
            <a href="/reveal/download-pptx" target="_blank">
                <button>
				    Last ned PowerPoint
			    </button>
		    </a>
	    </div>
        <iframe
		    src={previewUrl}
		    title="Reveal.js preview"
	    ></iframe>
    </div>




    <div class="chat_container">

        <div class="input-wrapper">
            <GrowingTextArea
                bind:value={prompt}
                placeholder="Beskriv hva du vil lage..."
                style="input"
                on:keydown={handleKeydown}
            />
            <button
                class="filled"
                on:click={handleSubmit}
                disabled={!prompt.trim() || loading}
            >
                {loading ? 'Genererer...' : 'Generer fil'}
            </button>
        </div>
    </div>
</main>

<style>
    .reveal_container {
        background-color: aqua;
        width: 60%;
        height: 600px;
        margin-left: auto;
        margin-right: auto;
        display: block;
    }

    .chat_container{
        width: 50%;
        height: 100px;
        margin-top: 30%;
        margin-left: auto;
        margin-right: auto;
        display: block;
    }

</style>
i