# Hugin Beta

A SvelteKit-based application leveraging AI capabilities through Mistral and OpenAI APIs.

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
MOCK_DB="true"
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
