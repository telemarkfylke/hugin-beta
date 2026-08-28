<script>
    import Chat from '$lib/components/Chat/Chat.svelte';
    import GrowingTextArea from '$lib/components/GrowingTextArea.svelte';
    import path from 'node:path';
    import { tr } from 'zod/locales';
    import Reveal from 'reveal.js';
    import { markdownFormatter } from "$lib/formatting/markdown-formatter"
    import { onMount } from 'svelte'
    import 'reveal.js/reveal.css';
    import 'reveal.js/theme/white.css';


      // globale state variabler for håndtere flere prosesser som blir endtret ettersom hva bruker ønsker å gjøre
    let currentMarkdownContent = $state('');
    let testCurrentMarkdownContent = $state( `
# Telemark
---
## Geografi
Telemark er et fylke i Norge, kjent for variert natur med fjorder, fjell, skoger og innsjøer. Fylket ligger i den sørøstlige delen av landet.
---
## Historie
Telemark har en rik kulturhistorie og er blant annet kjent for sin rolle i norsk folkekultur, bunadstradisjoner og folkemusikk.
---
## Byer og steder
- Skien
- Porsgrunn
- Notodden
- Rjukan
- Kragerø
---
## Natur og friluftsliv
Telemark byr på mange muligheter for friluftsliv, som ski, fotturer, sykling og båtliv. Hardangervidda og Gaustatoppen er populære områder.
---
## Kultur
Telemark er kjent for:
- Telemarksbunad
- Folkemusikk og dans
- Stavkirker
- Henrik Ibsens fødeby, Skien
---
## Næringsliv
Tradisjonelt har industri, kraftproduksjon og landbruk vært viktige næringer i Telemark. Reiseliv spiller også en stor rolle.
---
## Oppsummering
Telemark er et fylke med sterk kulturarv, vakker natur og mange spennende opplevelser for både innbyggere og besøkende.
  `);

    // Deler markdown-teksten opp i én bit per slide, delt på "---" på egen linje.
    let slides = $derived(
        testCurrentMarkdownContent
            .split(/^\s*---\s*$/m)
            .map(s => s.trim())
            .filter(s => s.length > 0)
    );

    let userID = $state(null);
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

        loading = false;

    }



    // "deck" må ligge her, utenfor onMount, slik at $effect-blokken
    // under også kan nå den (den er "usynlig" for kode utenfor
    // funksjonen den lages i, ellers).
    let deck;

  onMount(() => {
    userID = generateUserID()

    deck = new Reveal({
      embedded: true,
      controls: true,
      progress: true,
      center: true
    });
    deck.initialize();
  });

  // Kjører på nytt hver gang testCurrentMarkdownContent endres, og ber
  // Reveal.js regne ut slide-strukturen på nytt (den vet ikke selv at
  // innholdet i .slides har forandret seg).
  $effect(() => {
    testCurrentMarkdownContent;
    deck?.sync();
  });

</script>

<main class="filgenerering-page">
    <h1>Filgenerering</h1>
    <p class="lead">Beskriv hvilken presentasjon du vil lage, og se den bygges live under.</p>

    <div class="reveal">
  <div class="slides">
    {#if slides.length > 0}
      <!-- Ett <section> per slide, hver konvertert til HTML for seg selv -->
      {#each slides as slideMarkdown}
        <section>{@html markdownFormatter(slideMarkdown)}</section>
      {/each}
    {:else}
      <p class="empty-hint">Dokumentet er tomt. Skriv en instruksjon nedenfor for å komme i gang.</p>
    {/if}
  </div>
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
    .chat_card {
        background-color: var(--color-secondary-10);
        border: 2px solid var(--color-secondary-30);
        border-radius: 8px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
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
    .reveal {
        height: 900px;
        width: 900px;
        border-style: solid;
        border-width: 1px;

    }
</style>
