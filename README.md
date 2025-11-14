# Mugin beta

## Developing

Create a .env file with values
```bash
MISTRAL_API_KEY="hifdshfidsfhio"
OPENAI_API_KEY="fjkdlsfjkdsjf"
MOCK_DB="true" # no real db yet, so required for stuff to happen
```

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

### Frontend
Hva er diggest?

Hva om
vi har bare masse assistenter

vi tar å lager en rute per assistent
mugin.no/assistent/{id}

Hvis vi vil at det skal hoppe kan vi også ha
mugin.no/assisten/{id}/{conversationsid} eller mugin.no/assis/{id}/conversations/{id} DA HOPPER DET NOK, og er litt stress å styre med tror jeg

Hva med bare
mugin.no/assistant/{id} - thats it
også har man da state på den eine sida man er på med conversationId (så kan man bare swappe den som man trenger, og trenger ikke laste inn assistentsiden på nytt)
Når man bytter assistent, så må man laste side på nytt, men da trenger man jo også å hente tilsaverende conversations uansett.
OBS OBS, da må vi cleare chat vindu og styre og ornde, når man bytter conversationId

Eller hente AAAALT på root-load, og håndtere alt selv, men NEI TAKK.


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

# Bruker laster opp en fil
Hent hvilken agent den laster opp til
- Hvis mistral
  - Sjekk om det er en conversation der med et library allerede.
    - Hvis ja, last opp filen til det biblioteket
    - Hvis nei, lag et nytt bibilotek, knytt det til conversation, og last opp filen
  - Videre spørringer kan slenges på et tool_execuition entry "document_library" - kan vi klare å styre det basert på om det trengs? Eller skal den alltid søke i filene hvis bruker har lastet opp filer?
  - Når sletter vi biblioteker?


# Ny conversation
- Samma om mistral eller openai
- Man må gi med eg agent_id
- Dersom agent config har støtte for filer (altså ikke peker direkte mot en predefinert agent hos leverandør, kanskje vi alltid skal gjøre det?)
- Opprettes først nytt library/vector store som ligger klart
- Opprettes en ny agent basert på config, som får med seg evt kunnskapsgrunnla eksperter har sagt, i tillegg til en egen vector/store / bibiliotek som ble opprettet over her.
- Oppretter ny conversation, basert mot den nyopprette agenten
- Brukeropplastede filer havner i den ene nye vector store som ble knyttet til ny agent/conversation

- Kan vi oppdatere agenten i etterkant til å ha med seg en nytt library?


# Skal vi kunne laste opp flere filer på en gang?

Må sendes over til server, med godeste conversationId og libraryId
Må sjekke at de har tilgang på conversation, og at libraryId tilhører samme conversation
Må så laste opp en og en fil (hvertfall til Mistral), og sende responser tilbake? Kan bare ha en spinner kanskje, som sjekker status?
Eller bare laste opp en fil av gangen? Det vil sikkert ikke folk. Prøver med mange på en gang.


Mulighet for å legge filer RETT inn i konteksten, og å laste opp filer for kunnskapsgrunnlag til samtalen
OPEN AI - der kan man laste opp pdf rett i samtalen, ikke noe annet ser det ut som
Mistral - der kan man ikke laste opp noenting direkte i samtalen

