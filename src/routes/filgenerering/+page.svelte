<script>
    import Chat from '$lib/components/Chat/Chat.svelte';
    import GrowingTextArea from '$lib/components/GrowingTextArea.svelte';
    import path from 'node:path';
    import { tr } from 'zod/locales';
    import { onMount } from 'svelte'

    let currentMarkdownContent = $state('');
    let userID = $state(null);
    let previewUrl = $state('/filgenerering/pptx/reveal?t=' + Date.now());
    let prompt = $state('');
    let loading = $state(false);

    let display = $state(null);
    let send_btn = $state(null);
    let input = $state(null);

    let agentResponseIds = {
        "openaut": null,
    };
    console.log("ResponsID:", agentResponseIds)
    
    let agentResponseIDHistory = {
        "openaut": []
    }

    console.log("ResponsID_Historikk:", agentResponseIDHistory)
    function refreshPreview() {
        previewUrl = '/filgenerering/pptx/reveal?t=' + Date.now();
    }

        const STORAGE_KEY = 'filgenerering_user_id';

    export function generateUserID() {
        if (typeof localStorage === 'undefined') {
            return crypto.randomUUID();
        }

        let userID = localStorage.getItem(STORAGE_KEY);
        if (!userID) {
            userID = crypto.randomUUID();
            localStorage.setItem(STORAGE_KEY, userID);
        }

        // Sender med userID som cookie på alle forespørsler til serveren,
        // slik at den ikke må ligge synlig i URL-en.
        document.cookie = `userID=${userID}; path=/; max-age=31536000`;

        console.log("UserID:", userID);
        return userID;
    }

    async function sendMessage() {
        console.log("Du trykket på knappen")

        if (!prompt.trim() || loading) return;
        loading = true;

        const previousResponseId = agentResponseIDHistory[agentResponseIds];

        const respons = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt, previousResponseId })
        });

        const data = await respons.json();
        currentMarkdownContent = data.markdown;
        console.log("Response fra OpenAI: ", currentMarkdownContent)

        loading = false;

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



onMount(() => {
    userID = generateUserID();
})


</script>

<main class="filgenerering-page">
    <h1>Filgenerering</h1>
    <p class="lead">Beskriv hvilken presentasjon du vil lage, og se den bygges live under.</p>

    <div class="reveal_card">
        <div class="reveal_header">
            <h2>Forhåndsvisning</h2>
            <a href="/filgenerering/pptx/reveal/download-pptx" target="_blank">
                <button class="filled">Last ned PowerPoint</button>
            </a>
        </div>
        <iframe bind:this={display} src={previewUrl} title="Reveal.js preview"></iframe>
    </div>

    <div class="chat_card">
        <div class="input_wrapper" bind:this={input}>
            <GrowingTextArea
                bind:value={prompt}
                placeholder="Beskriv hva du vil lage..."
                style="input"
            />
            <div class="chat_actions">
                <button class="reset_btn" type="button" onclick={resetPrompt}>
                    Reset
                </button>
                <button
                    bind:this={send_btn}
                    class="send_btn filled"
                    onclick={sendMessage}
                    disabled={loading}
                >
                    {loading ? 'Genererer...' : 'Generer fil'}
                </button>
            </div>
        </div>
    </div>
</main>

<style>
    .filgenerering-page {
        max-width: 1600px;
        margin: 0 auto;
        padding: 1rem 1.25rem 3rem;
    }

    h1 {
        color: var(--color-primary);
        margin-bottom: 0.5rem;
    }

    .lead {
        color: var(--color-primary-80);
        margin-top: 0;
        margin-bottom: 1.5rem;
    }

    .reveal_card,
    .chat_card {
        background-color: var(--color-secondary-10);
        border: 2px solid var(--color-secondary-30);
        border-radius: 8px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
    }

    .reveal_header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .reveal_header h2 {
        margin: 0;
        font-size: 1.15rem;
        color: var(--color-primary);
    }

    iframe {
        width: 100%;
        height: 600px;
        border-radius: 8px;
        border: 1px solid var(--color-primary-20);
        display: block;
        background-color: white;
    }

    .input_wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .chat_actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
    }

    button.send_btn,
    button.reset_btn {
        padding: 0 1.25rem;
        font-size: 0.9rem;
    }

    button.send_btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
