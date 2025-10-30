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



