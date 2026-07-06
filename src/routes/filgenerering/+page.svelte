<script>
    import GrowingTextArea from '$lib/components/GrowingTextArea.svelte';

    let previewUrl = $state('/filgenerering/pptx/reveal?t=' + Date.now());
    let prompt = $state('');
    let loading = $state(false);

    let display = $state(null);
    let send_btn = $state(null);
    let input = $state(null);

    function refreshPreview() {
        previewUrl = '/filgenerering/pptx/reveal?t=' + Date.now();
    }


    async function sendMessage() {
        console.log("Du trykket på knappen")

        if (!prompt.trim() || loading) return;
        loading = true;

        const respons = await fetch('/api/filgenerering', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt })
        });
        console.log(respons)
        // TODO: behandle respons her

        let editFile = await fetch("/filgenerering/pptx/content");

        if (editFile.ok) {
            editFile = respons
            refreshPreview()
        } else {
            console.log("Får ikke sendt respons til content.md")
        }

        let content = "";
        if (editFile.ok) {
            content = await editFile.text();
        } else {
            console.log("ingen melding kommet")
        }

        loading = false;

    }
</script>

<main>
    <div class="reveal_container">
        <div class="reveal_vindu">
            <h1>Presentasjon</h1>
            <div class="actions">
                <a href="/filgenerering/pptx/reveal/download-pptx" target="_blank">
                    <button>Last ned PowerPoint</button>
                </a>
            </div>
            <iframe bind:this={display} src={previewUrl} title="Reveal.js preview"></iframe>
        </div>
    </div>

    <div class="chat_container">
        <div class="input_wrapper" bind:this={input}>
            <GrowingTextArea
                bind:value={prompt}
                placeholder="Beskriv hva du vil lage..."
                style="input"
            />
            <button
                bind:this={send_btn}
                class="send_btn"
                onclick={sendMessage}
                disabled={loading}
            >
                {loading ? 'Genererer...' : 'Generer fil'}
            </button>
        </div>
    </div>
</main>

<style>
    .reveal_container {
        width: 90%;
        margin-left: auto;
        margin-right: auto;
    }

    .chat_container {
        width: 50%;
        margin-top: 2rem;
        margin-left: auto;
        margin-right: auto;
    }

    .actions {
        margin-bottom: 1rem;
    }

    iframe {
        width: 80%;
        height: 600px;
        border-radius: 10px;
        margin-left: auto;
        margin-right: auto;
        display: block;
    }

    .input_wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    button.send_btn {
        align-self: flex-end;
        background-color: var(--color-primary);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 0.5rem 1.25rem;
        height: 2rem;
        font-family: inherit;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background-color 0.15s;
    }

    button.send_btn:hover:not(:disabled) {
        background-color: var(--color-primary-80);
    }

    button.send_btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
