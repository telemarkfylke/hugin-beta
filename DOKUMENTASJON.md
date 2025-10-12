# Hugin Beta - Prosjektdokumentasjon

## Innholdsfortegnelse
1. [Prosjektoversikt](#prosjektoversikt)
2. [Teknologistack](#teknologistack)
3. [Prosjektstruktur](#prosjektstruktur)
4. [Ruter og Funksjonalitet](#ruter-og-funksjonalitet)
5. [API-endepunkter](#api-endepunkter)
6. [Komponenter](#komponenter)
7. [Miljøvariabler](#miljøvariabler)
8. [Installasjon og Kjøring](#installasjon-og-kjøring)

---

## Prosjektoversikt

Hugin Beta er en Azure-basert webapplikasjon bygget med SvelteKit 5 som integrerer med OpenAI og Mistral AI API-er. Applikasjonen tilbyr flere AI-drevne chatbot-grensesnitt for ulike formål, inkludert kundeservice for kollektivtransport og generell AI-assistanse.

### Hovedfunksjoner
- **Fartebot**: En spesialisert chatbot for spørsmål om bysykkelutleie og kollektivtransport
- **OrgBotter**: En generell AI-assistent basert på OpenAI ChatKit
- **API-testing**: Verktøy for å teste OpenAI og Mistral API-integrasjoner
- **Tilgjengelighetsfokus**: Integrert axe-core for UI-validering

---

## Teknologistack

### Frontend
- **SvelteKit 5**: Full-stack rammeverk med server-side rendering
- **Svelte 5**: Moderne, reaktivt UI-rammeverk
- **Vite**: Rask bygge- og utviklingsserver

### Backend & API-integrasjoner
- **OpenAI API**: Integrert med GPT-5 og OpenAI ChatKit
- **Mistral AI**: Alternativ AI-modell for chat-funksjonalitet
- **Node.js**: Runtime-miljø for server-side kode

### Verktøy & Kvalitetssikring
- **axe-core**: Automatisk tilgjengelighetsvalidering
- **ESLint**: Kodeanalyse og linting
- **TypeScript/JSDoc**: Type-sikkerhet og dokumentasjon

### Deployment
- **Azure Web App**: Cloud hosting-plattform
- **adapter-auto**: SvelteKit adapter for Azure-kompatibilitet

---

## Prosjektstruktur

```
hugin-beta/
├── src/
│   ├── lib/
│   │   ├── components/           # Gjenbrukbare UI-komponenter
│   │   │   └── Orgbott.svelte   # OrgBot ChatKit-komponent
│   │   ├── data/                # Datakilder og konfigurasjoner
│   │   │   ├── systemledetekster.js  # Systemprompts for chatbots
│   │   │   └── rag_essay.js     # RAG (Retrieval Augmented Generation) data
│   │   ├── assets/              # Statiske ressurser (ikoner, bilder)
│   │   └── axe.js              # Tilgjengelighetsvalidering setup
│   │
│   ├── routes/                  # Siderutinger og API-endepunkter
│   │   ├── +page.svelte        # Hovedside (/)
│   │   ├── +layout.svelte      # Global layout
│   │   ├── fartebot/
│   │   │   └── +page.svelte    # Fartebot chatbot-side
│   │   ├── orgbotter/
│   │   │   └── +page.svelte    # OrgBotter chatbot-side
│   │   └── api/                # Server-side API-endepunkter
│   │       ├── openai/+server.js
│   │       ├── mistral/+server.js
│   │       ├── fartebot/+server.js
│   │       └── orgbotter/+server.js
│   │
│   └── app.html                # HTML-mal for applikasjonen
│
├── static/                     # Statiske filer (favicon, etc.)
├── package.json               # Prosjektavhengigheter og scripts
├── svelte.config.js          # SvelteKit konfigurasjon
├── vite.config.js            # Vite bygge-konfigurasjon
└── CLAUDE.md                 # Utviklerretningslinjer

```

---

## Ruter og Funksjonalitet

### 1. Hovedside (`/`)
**Filplassering**: `src/routes/+page.svelte`

#### Formål
Testside for å verifisere OpenAI og Mistral API-integrasjoner.

#### Funksjonalitet
- **OpenAI API Test**: Sender en forhåndsdefinert prompt til OpenAI GPT-5 modellen
  - Prompt: "Write a one-sentence bedtime story about a unicorn."
  - Viser responsen i JSON-format

- **Mistral API Test**: Tester Mistral AI-integrasjon
  - Prompt: "What is the best French cheese?"
  - Viser responsen i JSON-format

#### Brukergrensesnitt
- To knapper for å teste hver API
- Loading-state mens forespørsel behandles
- Feilhåndtering med tydelige feilmeldinger
- Responsvisning i formatert tekstboks

#### Tekniske detaljer
```javascript
// Eksempel på API-kall
async function testOpenAI() {
  const res = await fetch('/api/openai');
  const data = await res.json();
  // Vis respons
}
```

---

### 2. Fartebot-rute (`/fartebot`)
**Filplassering**: `src/routes/fartebot/+page.svelte`

#### Formål
En spesialisert kundeservice-chatbot for spørsmål om bysykkelutleie og kollektivtransport.

#### Funksjonalitet

##### Frontend-komponenten
- **Inputfelt**: Brukeren kan skrive inn spørsmål
- **Streaming-respons**: AI-svar vises i sanntid mens de genereres
- **Feilhåndtering**: Validering og feilmeldinger for ugyldige forespørsler

##### Backend API-endepunkt
**Filplassering**: `src/routes/api/fartebot/+server.js`

**Teknisk implementasjon**:
- **Modell**: OpenAI GPT-5
- **Reasoning effort**: Low (rask respons)
- **Vector Store**: Bruker `VS_BYSYKKEL` for kontekstbasert søk
- **Streaming**: Server-Sent Events (SSE) for sanntidsvisning

**Systemprompt**: Definert i `src/lib/data/systemledetekster.js`
- Hilser brukeren velkommen på første melding
- Svarer på norsk bokmål, nynorsk, engelsk, tysk eller fransk
- Bruker kun kontekst fra opplastede dokumenter
- Eskalerer til kundeservice etter 4 uavklarte spørsmål
- Unngår kontroversielle emner (politikk, religion, juss, økonomi)

**Eksempel på systemprompt-logikk**:
```javascript
instructions: systemledetekster.fartebort.prompt
// Inneholder detaljerte instruksjoner for:
// - Kundepleie og samtalehåndtering
// - Språkvariasjon
// - Eskaleringsregler
// - Kommunikasjonsstil
```

##### RAG (Retrieval Augmented Generation)
Fartebot bruker OpenAI's file_search-verktøy med en vector store som inneholder:
- Informasjon om bysykkelutleie
- Kollektivtransport-data
- Priser og betingelser
- Ofte stilte spørsmål

**API-flyt**:
```
Bruker → Frontend (input) → POST /api/fartebot
                                    ↓
                           OpenAI GPT-5 + Vector Store
                                    ↓
                           Streaming respons (SSE)
                                    ↓
                           Frontend (sanntidsvisning)
```

##### Streaming-implementasjon
Frontend håndterer streaming med ReadableStream:
```javascript
const reader = res.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Parse SSE-data
  if (line.startsWith('data: ')) {
    const event = JSON.parse(line.slice(6));
    if (event.delta) {
      response += event.delta; // Legg til ny tekst
    }
  }
}
```

---

### 3. OrgBotter-rute (`/orgbotter`) ⭐ HOVEDFOKUS

**Filplassering**:
- Frontend: `src/routes/orgbotter/+page.svelte`
- Komponent: `src/lib/components/Orgbott.svelte`
- API: `src/routes/api/orgbotter/+server.js`

#### Formål
OrgBotter er en moderne, generell AI-assistent som bruker OpenAI ChatKit - et ferdigbygd chat-widget fra OpenAI som gir en fullstendig chatopplevelse med minimal konfigurasjon.

---

#### Arkitektur og Dataflyt

```
┌─────────────────────────────────────────────────────────┐
│  1. Bruker laster /orgbotter                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  2. Svelte rendrer Orgbott-komponenten                 │
│     - Laster ChatKit JS-bibliotek fra CDN              │
│     - Initialiserer komponenten ved onMount()          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  3. getClientSecret() kalles automatisk                │
│     → POST /api/orgbotter                              │
│       Body: { deviceId: 'test-device-123' }            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  4. Backend API-endepunkt (/api/orgbotter/+server.js) │
│     → POST https://api.openai.com/v1/chatkit/sessions │
│       Headers:                                          │
│         - Authorization: Bearer OPENAI_API_KEY_LABS    │
│         - OpenAI-Beta: chatkit_beta=v1                 │
│       Body:                                             │
│         - workflow: { id: AGENT_WORKFLOW }             │
│         - user: deviceId                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  5. OpenAI returnerer session-objekt                   │
│     {                                                   │
│       id: "cksess_xxx",                                │
│       client_secret: "ek_xxx",                         │
│       status: "active",                                │
│       expires_at: timestamp,                           │
│       workflow: { id: "wf_xxx" }                       │
│     }                                                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  6. Frontend mottar client_secret                      │
│     → ChatKit-widget initialiseres med hemmeligheten   │
│     → Chat-grensesnittet blir klart for bruk           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  7. Bruker sender melding i chat                       │
│     → ChatKit-widget håndterer kommunikasjon           │
│       direkte med OpenAI API                           │
│     → AI-respons vises i sanntid                       │
└─────────────────────────────────────────────────────────┘
```

---

#### Frontend-komponent (`Orgbott.svelte`)

##### HTML-struktur
```svelte
<svelte:head>
  <!-- Last inn ChatKit JavaScript-bibliotek fra OpenAI CDN -->
  <script src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js" async></script>
</svelte:head>

<div class="chat-container">
  <!-- OpenAI ChatKit web-komponent -->
  <openai-chatkit id="my-chat"></openai-chatkit>
</div>
```

##### JavaScript-logikk

**1. getClientSecret() - Session Token-funksjon**
```javascript
async function getClientSecret() {
  try {
    // Kaller backend API for å få ChatKit-session
    const res = await fetch('/api/orgbotter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'test-device-123' })
    });

    const data = await res.json();
    console.log('Session created:', data);

    // Returnerer client_secret til ChatKit-widget
    return data.client_secret;
  } catch (error) {
    console.error('Failed to get client secret:', error);
    throw error;
  }
}
```

**Hvorfor trenger vi client_secret?**
- ChatKit krever en autentisert session for å fungere
- `client_secret` er en tidsbasert nøkkel som knytter brukeren til en workflow
- Nøkkelen utløper etter en bestemt tid (se `expires_at` i API-responsen)
- Backend håndterer den sikre API-nøkkelen (`OPENAI_API_KEY_LABS`) slik at den aldri eksponeres til frontend

---

**2. onMount() - Komponentinitialisering**
```javascript
onMount(() => {
  const initChatKit = () => {
    // Finn ChatKit web-komponenten i DOM
    const chatkit = document.getElementById('my-chat');

    if (chatkit && chatkit.setOptions) {
      // ChatKit er lastet og klar
      chatKitControl = chatkit;
      console.log('ChatKit element found, initializing...');

      // Konfigurer ChatKit med getClientSecret-funksjon
      chatkit.setOptions({
        api: {
          getClientSecret  // ChatKit kaller denne automatisk ved behov
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
```

**Initialiserings-sekvens**:
1. Komponenten monteres i DOM
2. `onMount()` lifecycle-hook kjører
3. Sjekker om ChatKit-elementet eksisterer og har `setOptions`-metode
4. Hvis nei: Vent 100ms og prøv igjen (polling)
5. Hvis ja: Konfigurer med `getClientSecret`-funksjon
6. ChatKit kaller `getClientSecret()` automatisk når den trenger en session

---

##### CSS-styling

**Container-styling**:
```css
.chat-container {
  width: 100%;
  max-width: 900px;      /* Maksimal bredde for lesbarhet */
  height: 700px;         /* Fast høyde for konsistent layout */
  margin: 0 auto;        /* Sentrert på siden */
  background: #ffffff;
  border-radius: 12px;   /* Avrundede hjørner */
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);  /* Diskret skygge */
  overflow: visible;     /* Lar innhold vises utenfor hvis nødvendig */
  border: 1px solid #e5e7eb;
  position: relative;
}
```

**ChatKit-element styling**:
```css
openai-chatkit {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  position: absolute;    /* Fyller hele containeren */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* Sikrer at alle child-elementer er synlige */
:global(openai-chatkit *) {
  visibility: visible !important;
  opacity: 1 !important;
  display: initial !important;
}
```

**Responsiv design**:
```css
@media (max-width: 768px) {
  .chat-container {
    max-width: 100%;     /* Full bredde på mobile enheter */
    height: 600px;       /* Redusert høyde for mindre skjermer */
    border-radius: 8px;  /* Mindre avrunding */
  }
}
```

---

#### Backend API-endepunkt (`/api/orgbotter/+server.js`)

**Hovedfunksjon**: Proxy for ChatKit session-oppretting

```javascript
import { OPENAI_API_KEY_LABS, AGENT_WORKFLOW } from '$env/static/private';

export async function POST({ request }) {
  try {
    // Parse brukerens forespørsel
    const { deviceId, workflow } = await request.json();

    // Bruk standard workflow hvis ikke spesifisert
    const workflowId = workflow || AGENT_WORKFLOW;
    console.log('Creating session with workflow:', workflowId);

    // Kall OpenAI ChatKit Sessions API
    const response = await fetch('https://api.openai.com/v1/chatkit/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'chatkit_beta=v1',  // Beta API-versjon
        'Authorization': `Bearer ${OPENAI_API_KEY_LABS}`
      },
      body: JSON.stringify({
        workflow: { id: workflowId },
        user: deviceId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Håndter API-feil
      return new Response(JSON.stringify({
        error: data.error || 'API request failed',
        details: data
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Returner kun client_secret til frontend
    return new Response(JSON.stringify({
      client_secret: data.client_secret
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**Viktige aspekter**:

1. **Sikkerhet**:
   - API-nøkkel lagres kun på server-side
   - Frontend mottar kun `client_secret`, ikke den fulle responsen

2. **Workflow-system**:
   - `AGENT_WORKFLOW` er en miljøvariabel som peker til en konfigurert AI-workflow hos OpenAI
   - Workflows definerer AI-agentens oppførsel, modell, og instruksjoner

3. **Device ID**:
   - Identifiserer unikt hver bruker/sesjon
   - Kan brukes for å spore samtalehistorikk
   - I produksjon bør dette være en UUID eller bruker-ID

---

#### OpenAI ChatKit Sessions API Respons

**Fullstendig API-respons** (som backend mottar):
```json
{
  "id": "cksess_ANONYMIZED_SESSION_ID",
  "object": "chatkit.session",
  "status": "active",
  "chatkit_configuration": {
    "automatic_thread_titling": {
      "enabled": true
    },
    "file_upload": {
      "enabled": false,
      "max_file_size": 512,
      "max_files": 10
    },
    "history": {
      "enabled": true,
      "recent_threads": null
    }
  },
  "client_secret": "ek_ANONYMIZED_CLIENT_SECRET",
  "expires_at": 1760170633,
  "max_requests_per_1_minute": 10,
  "rate_limits": {
    "max_requests_per_1_minute": 10
  },
  "user": "test-device-1760170033",
  "workflow": {
    "id": "wf_YOUR_WORKFLOW_ID",
    "state_variables": null,
    "tracing": {
      "enabled": true
    },
    "version": null
  }
}
```

**Feltforklaringer**:

| Felt | Beskrivelse |
|------|-------------|
| `id` | Unik session ID (starter med `cksess_`) |
| `status` | Session-status: `active`, `expired`, eller `revoked` |
| `client_secret` | Autentiseringsnøkkel for ChatKit-widget |
| `expires_at` | Unix timestamp for når session utløper |
| `max_requests_per_1_minute` | Rate limit for API-kall |
| `chatkit_configuration` | Widget-innstillinger (titling, filopplasting, historikk) |
| `workflow.id` | ID til AI-workflow som styrer chatbot-oppførsel |

---

#### Props og Konfigurasjon

**Bruk av komponenten i rute**:
```svelte
<!-- src/routes/orgbotter/+page.svelte -->
<script>
  import Orgbott from '$lib/components/Orgbott.svelte';
</script>

<Orgbott />
```

**Fremtidig utvidelse med props**:
```svelte
<!-- Eksempel på hvordan komponenten kan konfigureres -->
<Orgbott
  deviceId="custom-device-123"
  workflowId="wf_custom_workflow"
  title="Min Custom Chatbot"
  theme="dark"
/>
```

For å støtte props, legg til i `Orgbott.svelte`:
```javascript
export let deviceId = 'test-device-123';
export let workflowId = null;
export let title = 'OrgBot Assistant';
export let theme = 'light';
```

---

#### Feilsøking og Debugging

**Console-logging**:
Komponenten logger viktige hendelser:
```
✅ "Waiting for ChatKit to load..."
✅ "ChatKit element found, initializing..."
✅ "ChatKit options set successfully"
✅ "Session created: { client_secret: '...' }"
```

**Vanlige problemer**:

1. **ChatKit vises ikke**:
   - Sjekk at CDN-skriptet lastes: Se i Network-tab
   - Verifiser at `getClientSecret()` returnerer gyldig token

2. **AI svarer ikke**:
   - Workflow må være konfigurert i OpenAI dashboard
   - Sjekk at `AGENT_WORKFLOW` miljøvariabel er satt

3. **"Invalid method for URL" feil**:
   - ChatKit prøver å kalle OpenAI API direkte
   - Sikre at `OPENAI_API_KEY_LABS` er korrekt

4. **Session utløper**:
   - `client_secret` er tidsbegrenset
   - ChatKit bør automatisk be om ny token via `getClientSecret()`

---

#### Brukeropplevelse

**Funksjoner i ChatKit-widget**:
- ✅ Automatisk trådtitling (automatic_thread_titling)
- ✅ Samtalehistorikk (history)
- ✅ Sanntids AI-respons
- ✅ Markdown-formattering i meldinger
- ❌ Filopplasting (deaktivert i nåværende konfigurasjon)

**Responsivitet**:
- Desktop (>768px): 900px bred, 700px høy
- Mobile (<768px): Full bredde, 600px høy
- Sentrert på siden med moderne skygge-effekt

---

## API-endepunkter

### Oversikt

| Endepunkt | Metode | Formål | API-integrasjon |
|-----------|--------|--------|-----------------|
| `/api/openai` | GET | Test OpenAI API | OpenAI GPT-5 |
| `/api/mistral` | GET | Test Mistral API | Mistral Large |
| `/api/fartebot` | POST | Kundeservice chatbot | OpenAI GPT-5 + Vector Store |
| `/api/orgbotter` | POST | ChatKit session-oppretting | OpenAI ChatKit |

---

### `/api/openai` - OpenAI Test-endepunkt

**Metode**: GET
**Formål**: Enkelt endepunkt for å verifisere OpenAI API-forbindelse

**Request**: Ingen parametere
**Response**:
```json
{
  "message": "Once upon a time, a shimmering unicorn danced through a moonlit meadow, sprinkling dreams upon sleeping children."
}
```

**Kode**:
```javascript
const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const response = await client.responses.create({
  model: "gpt-5",
  input: "Write a one-sentence bedtime story about a unicorn."
});
return { message: response.output_text };
```

---

### `/api/mistral` - Mistral Test-endepunkt

**Metode**: GET
**Formål**: Teste Mistral AI-integrasjon

**Request**: Ingen parametere
**Response**:
```json
{
  "message": "Comté is widely considered one of the best French cheeses..."
}
```

**Kode**:
```javascript
const client = new Mistral({ apiKey: env.MISTRAL_API_KEY });
const chatResponse = await client.chat.complete({
  model: 'mistral-large-latest',
  messages: [{ role: 'user', content: 'What is the best French cheese?' }]
});
return { message: chatResponse.choices[0].message.content };
```

---

### `/api/fartebot` - Kundeservice Chatbot

**Metode**: POST
**Formål**: Håndtere spørsmål om bysykkel og kollektivtransport

**Request**:
```json
{
  "question": "Hva koster det å leie bysykkel?"
}
```

**Response**: Server-Sent Events (SSE) stream
```
data: {"type": "response.text.delta", "delta": "Hei"}
data: {"type": "response.text.delta", "delta": ", du"}
data: {"type": "response.text.delta", "delta": " har"}
...
data: [DONE]
```

**Tekniske detaljer**:
- **Modell**: GPT-5 med `reasoning: { effort: "low" }`
- **Vector Store**: `VS_BYSYKKEL` (miljøvariabel)
- **Streaming**: Ja, via ReadableStream
- **Systemprompt**: Fra `systemledetekster.fartebort.prompt`

**Tools**:
```javascript
tools: [{
  type: "file_search",
  vector_store_ids: [env.VS_BYSYKKEL]
}]
```

---

### `/api/orgbotter` - ChatKit Session

**Metode**: POST
**Formål**: Opprette ChatKit-session for OrgBotter

**Request**:
```json
{
  "deviceId": "test-device-123",
  "workflow": "wf_YOUR_WORKFLOW_ID"  // Valgfri
}
```

**Response**:
```json
{
  "client_secret": "ek_ANONYMIZED_CLIENT_SECRET"
}
```

**API-kall til OpenAI**:
```javascript
POST https://api.openai.com/v1/chatkit/sessions
Headers:
  - Content-Type: application/json
  - OpenAI-Beta: chatkit_beta=v1
  - Authorization: Bearer OPENAI_API_KEY_LABS
Body:
  {
    "workflow": { "id": "wf_xxx" },
    "user": "device-id"
  }
```

---

## Komponenter

### Orgbott.svelte

**Plassering**: `src/lib/components/Orgbott.svelte`

**Beskrivelse**: Komplett ChatKit-basert chatbot-komponent

**Avhengigheter**:
- OpenAI ChatKit CDN (`https://cdn.platform.openai.com/deployments/chatkit/chatkit.js`)
- `/api/orgbotter` API-endepunkt

**Props** (kan utvides):
```javascript
// Nåværende: Ingen props (hardkodet konfigurasjon)
// Fremtidig:
export let deviceId = 'test-device-123';
export let workflowId = null;
export let maxWidth = '900px';
export let height = '700px';
```

**Lifecycle**:
1. Component mounted
2. Load ChatKit script
3. Initialize ChatKit element
4. Call `getClientSecret()`
5. Render chat UI
6. Handle user interactions

---

## Miljøvariabler

### Oversikt
Alle sensitive API-nøkler og konfigurasjoner lagres i `.env`-fil (ikke committet til git).

### Påkrevde variabler

#### OpenAI
```bash
# Standard OpenAI API-nøkkel (for test-endepunkt)
OPENAI_API_KEY="sk-proj-..."

# OpenAI Labs API-nøkkel (for ChatKit)
OPENAI_API_KEY_LABS="sk-proj-..."

# OpenAI kollektiv-spesifikk nøkkel (for Fartebot)
OPENAI_API_KEY_KOLLEKTIV="sk-proj-..."

# ChatKit Workflow ID
AGENT_WORKFLOW="wf_YOUR_WORKFLOW_ID"
```

#### Mistral AI
```bash
MISTRAL_API_KEY="your_mistral_api_key_here"
```

#### Vector Stores
```bash
# Bysykkel vector store ID
VS_BYSYKKEL="vs_YOUR_VECTOR_STORE_ID"
```

### `.env.example` (template)
```bash
# OpenAI API Keys
OPENAI_API_KEY=your_openai_key_here
OPENAI_API_KEY_LABS=your_labs_key_here
OPENAI_API_KEY_KOLLEKTIV=your_kollektiv_key_here

# Mistral API Key
MISTRAL_API_KEY=your_mistral_key_here

# OpenAI Workflow & Vector Store
AGENT_WORKFLOW=your_workflow_id_here
VS_BYSYKKEL=your_vector_store_id_here
```

---

## Installasjon og Kjøring

### Forutsetninger
- **Node.js**: v18 eller høyere
- **npm**: v9 eller høyere
- **Git**: For kloning av repository

### Installasjonssteg

1. **Klone repository**:
```bash
git clone <repository-url>
cd hugin-beta
```

2. **Installere avhengigheter**:
```bash
npm install
```

3. **Sette opp miljøvariabler**:
```bash
cp .env.example .env
# Rediger .env og legg til dine API-nøkler
```

4. **Starte utviklingsserver**:
```bash
npm run dev
```

Applikasjonen kjører nå på `http://localhost:5173`

### Tilgjengelige kommandoer

```bash
npm run dev       # Start utviklingsserver med hot reload
npm run build     # Bygg for produksjon
npm run preview   # Forhåndsvis produksjonsbygg
npm run check     # Kjør type-sjekk og SvelteKit sync
npm run lint      # Kjør ESLint kodeanalyse
```

### Testing av ruter

- **Hovedside**: http://localhost:5173/
- **Fartebot**: http://localhost:5173/fartebot
- **OrgBotter**: http://localhost:5173/orgbotter

### Debugging

**Browser DevTools**:
- Console: Se logger fra `getClientSecret()` og ChatKit-initialisering
- Network: Verifiser API-kall til `/api/orgbotter` og OpenAI
- Elements: Inspiser `<openai-chatkit>` web-komponent

**Server-side logging**:
```javascript
console.log('Creating session with workflow:', workflowId);
```

---

## Tilgjengelighet (Accessibility)

### axe-core Integrasjon

**Plassering**: `src/lib/axe.js`

Automatisk validering av UI-komponenter kjøres i utviklingsmodus:
- Sjekker WCAG 2.1 AA-standarder
- Logger tilgjengelighetsproblemer i console
- Kjører kun i development (ikke production)

**Best practices**:
- All tekst har tilstrekkelig kontrast
- Interaktive elementer er keyboard-navigerbare
- Skjermleser-støtte via semantisk HTML
- ARIA-labels der nødvendig

---

## Fremtidige Forbedringer

### For OrgBotter
- [ ] Tilpassbare props (deviceId, workflowId, styling)
- [ ] Persistente samtaler på tvers av sessions
- [ ] Filopplasting-støtte
- [ ] Custom temaer (lys/mørk modus)
- [ ] Bedre feilhåndtering og retry-logikk
- [ ] Analytics og brukerstatistikk

### For Fartebot
- [ ] Multi-språk støtte (dynamisk språkdeteksjon)
- [ ] Samtalehistorikk for brukere
- [ ] Feedback-system for svar
- [ ] Integrasjon med kundeservicesystem

### Generelt
- [ ] Enhetstester (Vitest)
- [ ] E2E-tester (Playwright)
- [ ] CI/CD pipeline for Azure
- [ ] Monitoring og logging (Application Insights)
- [ ] Rate limiting på API-endepunkter

---

## Kontakt og Support

**Utviklet av**: TFK og VFK
**Prosjekt**: Hugin Beta
**Versjon**: 0.0.1 bleeding alpha

For spørsmål eller problemer, se `CLAUDE.md` for utviklerretningslinjer.

---

**Sist oppdatert**: 11. oktober 2025
