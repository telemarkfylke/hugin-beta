<!--
  Orgbott Chatbot-komponent

  Bruker OpenAI ChatKit - et ferdigbygd chat-widget som gir fullstendig chatopplevelse.
  ChatKit håndterer UI, meldingshåndtering og kommunikasjon med OpenAI API.
-->
<svelte:head>
  <!-- Last inn ChatKit-bibliotek fra OpenAI CDN -->
  <script src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js" async></script>
</svelte:head>

<script>
  import { onMount } from 'svelte';

  /**
   * Henter client_secret fra backend for ChatKit-autentisering
   * ChatKit kaller denne automatisk når den trenger en ny session
   * @returns {Promise<string>} Client secret for ChatKit-session
   */
  async function getClientSecret() {
    try {
      const res = await fetch('/api/orgbotter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId: 'test-device-123' })
      });
      const data = await res.json();
      console.log('Session created:', data);
      return data.client_secret;
    } catch (error) {
      console.error('Failed to get client secret:', error);
      throw error;
    }
  }

  // Referanse til ChatKit web-komponent
  let chatKitControl;

  onMount(() => {
    /**
     * Initialiserer ChatKit-widgeten når komponenten er montert
     * Bruker polling (setTimeout) for å vente på at ChatKit-skriptet lastes
     */
    const initChatKit = () => {
      const chatkit = document.getElementById('my-chat');

      // Sjekk om ChatKit er lastet og klar
      if (chatkit && chatkit.setOptions) {
        chatKitControl = chatkit;
        console.log('ChatKit element found, initializing...');

        // Konfigurer ChatKit med getClientSecret-funksjon
        chatkit.setOptions({
          api: {
            getClientSecret  // ChatKit bruker denne for å hente autentisering
          }
        });

        console.log('ChatKit options set successfully');
      } else {
        // ChatKit ikke lastet ennå, prøv igjen om 100ms
        console.log('Waiting for ChatKit to load...');
        setTimeout(initChatKit, 100);
      }
    };

    initChatKit();
  });
</script>

<div class="chat-container">
  <openai-chatkit id="my-chat"></openai-chatkit>
</div>

<style>
  .chat-container {
    width: 100%;
    max-width: 900px;
    height: 700px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    overflow: visible;
    border: 1px solid #e5e7eb;
    position: relative;
  }

  openai-chatkit {
    display: block !important;
    width: 100% !important;
    height: 100% !important;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  /* Sikrer at alle child-elementer i ChatKit er synlige */
  :global(openai-chatkit *) {
    visibility: visible !important;
    opacity: 1 !important;
    display: initial !important;
  }

  /* Responsiv design for mobile enheter */
  @media (max-width: 768px) {
    .chat-container {
      max-width: 100%;
      height: 600px;
      border-radius: 8px;
    }
  }
</style>
