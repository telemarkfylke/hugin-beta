import {env} from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import OpenAI from "openai";
import fs from 'node:fs/promises';
import path from 'node:path';


// Bruk systemInstruks fra systeminstruks.js, eller fallback til standardverdi

// Hent OpenAI API-nøkkel fra miljøvariabler
const openai_api_key = env.OPENAI_API_KEY_PROJECT_DEFAULT;


// Oppretter en OpenAI-klient med API-nøkkelen
const client = new OpenAI({
    apiKey: openai_api_key
});

if (!openai_api_key) {
    console.error("OPENAI_API_KEY is not set in environment variables.");
    throw new Error("OPENAI_API_KEY is required");
}


// Denne funksjonen håndterer POST-forespørsler til OpenAI-endpointet, sender melding og instruksjoner til OpenAI API, og returnerer svaret og response ID
/** @type {import('./$types').requestHandler} */

// Håndterer POST-forespørsler, sender melding og instruksjoner til OpenAI API, og returnerer svaret og response ID
export async function POST({ request, cookies }) {
    try {
        // henter melding og tidligere response ID fra forespørselen, userID fra cookien
        const { message, previousResponseId } = await request.json();
        const userID = cookies.get('userID');

        if (!userID) {
            return json({ error: "userID mangler" }, { status: 400 });
        }

        // Stien til markdown-filen som pandoc leser fra
        const contentPath = path.join(process.cwd(), 'src', 'routes', 'filgenerering', 'pptx', 'data', `${userID}.md`);

        // Oppretter en forespørsel til OpenAI API med melding, systeminstruksjoner og tidligere response ID, og mottar svaret
        const response = await client.responses.create({
            model: "gpt-5.4",
            instructions: `You are a document editor. The user will give you a document (in markdown) and a prompt describing what to change.
            Apply the requested changes to the document and return ONLY the full updated markdown document — no explanations, no preamble, no code fences around the whole document.
            Preserve all parts of the document that the prompt does not ask you to change.`,
            input: [
                {
                    role: "user",
                    content: message,
                },
            ],
            previous_response_id: previousResponseId,

        });
        // Skriver OpenAI-svaret til brukerens egen markdown-fil, som pandoc leser fra
        console.log("File for user is generated for:", contentPath);
        await fs.writeFile(contentPath, response.output_text, 'utf-8');

        // returnerer bare en bekreftelse + response ID, selve teksten trenger ikke tilbake til frontend
        return json({
            ok: true,
            responseId: response.id
        });
    } catch (error) { // håndterer eventuelle feil som oppstår under API-kallet og returnerer en feilmelding
        console.error("Error in OpenAI API call:", error);
        return json({ error: "An error occurred while processing your request." }, { status: 500 });
    }
    
}

console.log("System")