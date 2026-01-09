# Hugin Beta

A SvelteKit-based application leveraging AI capabilities through Mistral and OpenAI APIs.


## Description
- A SvelteKit-application for an internal AI-agent web app, with support for several AI-providers.
- The goal is to provide a democratic, secure, flexible, and user-friendly AI-solution for our internal users and students.
- We want built-in privacy for our users, and to keep them effective and happy.

## Architecture
- /api/chat
  - Ligner på responses api - man sender inn ALT som trengs for å få en chat-response

- Det vi trenger til første omgang er en chat med mulighet for fil-input, og kunne bruke flere leverandører/modeller. Ferdig. Med moderne design.


## old? Architecture
- We want to build an API-first solution, where everything you can do in the frontend, is also available throug API in the backend
- SvelteKit App, with both frontend and backend in the same project.

<img width="1111" height="763" alt="image" src="https://github.com/user-attachments/assets/ecbdd982-0d79-4b94-8cab-b172a5291a5d" />

### Project structure
- src
  - lib
    - `Here are all types, shared modules and components. Code shared by the frontend and backend is here too.`
    - server
      - `Here are all files that can only be run server-side. Svelte makes sure none of these are imported to frontend`
  - routes
    - `Here are all the routes for the application`
    - api
      - `Here are all the API routes for the application`
  - style.css
    - `Here is the global styling defined`
hei

### Solution-principles
- Our main entry point to AI are agents. Our agents work the same way everywhere, and the Agent-Component can be used anywhere, and with any AI-provider. Our agents are wrappers that convert underlying AI providers to a common structure and functionality.
- We use a DB (MongoDB), to keep track of our own Agents, Conversations, Vector stores, Files, access control, and application configuration. [See mock-db-data for structure example](./src/lib/server/db/mockdb-data.example.ts)
- An Agent is connected to a underlying AI-provider, with additional configurations.
  - All agents must be defined with a specific type, that determines which AI-provider should be used, and how it is configured.
  - An Agent can have predefined Vector stores connected to it.
- A Conversation is connected to an Agent, and a specific user
  - A Conversation can have a user-specific vector store connected to it.
- We want to be able to expand the solution to several AI providers, without having to rewrite the whole thing.

#### Agents
All agent types must implement the [IAgent interface](./src/lib/types/agents.ts)
- To create a new type of agent, create a new agent type in [./src/lib/types/agents.ts](./src/lib/types/agents.ts), with a type property as discriminator, and add it to AgentConfig. Add it to [createAgent](./src/lib/server/agents/agents.ts), and implement the functionality of it as an IAgent.
- To use it, create a new Agent with this type, and it should be good to go in both frontend and API 👍

### Design
- We want an accessible application
- Consistent design
- Mobile support
- Look nice

## Prerequisites

- Node.js (latest LTS version recommended)
- npm, pnpm, or yarn package manager
- Mistral API key
- OpenAI API key

## Setup

### Environment Configuration

Create a `.env` file in the project root with the following variables:

```bash
MISTRAL_API_KEY="your-mistral-api-key"
OPENAI_API_KEY="your-openai-api-key"
MOCK_DB="true" # If you want in-memory db
MOCK_AUTH="true" # If you are running locally
MOCK_AUTH_ROLES="Employee,Admin" # Comma-separated list of role-values you want to mock the current user to have (corresponds to the values in APP_ROLE_X env variables)
MOCK_AUTH_GROUPS="a23d4ddd-8e3a-40ca-b4ce-a32e87508094" # Comma-separated list of groupIds you want to mock the current user to be a member of
DEFAULT_AGENT_ID="mistral-conversation"
APP_ROLE_EMPLOYEE="Employee"
APP_ROLE_STUDENT="Student"
APP_ROLE_ADMIN="Admin"
APP_ROLE_AGENT_MAINTAINER="AgentMaintainer"
```

> **Note:** `MOCK_DB` is currently required as database integration is in development.

### Installation

Install project dependencies:

```bash
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

To automatically open the application in your browser:

```bash
npm run dev -- --open
```

## Production

### Building

Create a production build:

```bash
npm run build
```

### Preview

Preview the production build locally:

```bash
npm run preview
```

## Deployment

Deployment requires installing an appropriate [SvelteKit adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

Built with ❤️ by the Mugin Team.



