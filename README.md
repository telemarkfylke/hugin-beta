# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
>
> VFK FTW!


## Tanker

### Ting å tenke på
- Conversations og relatedConversationId må vi nok enten beskrrive veldig godt, eller navngi så vi faktsik skjønner det.
  - Jau, jeg ga de de nytt navn nå
- Hva med å bare bruke id-er fra conversations(som kommer fra mistral/openai) som id for våre conversations?

- Hovedsiden er en basic chat i første omgang mot mistral (kan man bytte modeller på hovedsiden? Tenker ja)
  - Mulighet for filopplasting, spørre om ting
  - Det skal fungerer på mobba
  - Raske veier til assistent. Pin en assistent.
  - Gjør det vanskelig å finne bottene. NOOOOT
  
  - Plukk botter fra en DB, ikke en config-fil
  - Tilgangsstyring til botter??
    - Plage Bjørn, Entra-grupper?
  - Mugin 2.0 KUN tilgjengelig bak ENTRA?

DB - hvordan ser en bot ut a??
collection "assistants"


// Bruk den under
{
  _id
  name: "Tullebotten",
  type: 'mistral',
  config: {
    assistantID: plugg på denne - ferdig
  }
}

SKAl vi tenke at alle chattene våres egt er assistants.

API

Assistants

GET api/assistants
- Får tilbake de man har tilgang på (fra DB)

POST api/assistants/{id}/conversation
- Starte en samtale, får tilbake en id

POST api/assistants/{id}/conversation/{id}/message
- Får tilbake en ResponseStream basert på hva du sendte inn

DELETE api/assistants/{id}/conversation/{id}

Kan vi få til et generisk endepunkt som ordner det stream-greiene da? Det håndteres jo ulikt av de ulike leverandørene. ME får sjå





# Struktur

I vår mongodb

collection "assistants"

en assistant {
  _id
  name: "Tullebotten",
  type: 'mistral',
  config: {
    assistantID: assitantId fra mistral
  },
  accessGroups: [
    dflkdsjflkdsf
  ]
}

bruker hente assistent

får da config

bruker påkalle POST assistant/_id/conversations for å starte en ny conversation

får bruker tilbake enten en stream eller et objekt med response og conversationsId

bruker kan så påkalle POST assistant/_id/conversations/conversation_id for å fortsette samtalen. 


POST Conversation (tom prompt)


POST Conversation/id for en message






