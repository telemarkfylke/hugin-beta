import type { FunctionTool } from "@mistralai/mistralai/models/components";


// Beskrivelse av funksjonen som legger sammen to tall- Beskrivelsen sørger for at funkskjonne trigges når den skal
export const beskrivelseLeggSammenToTall: FunctionTool = {
    type: "function",
    function: {
        name: "leggSammenToTall",
        description: "Legger sammen to tall og returnerer summen.",
        parameters: {
            type: "object",
            properties: {
                tall1: {
                    type: "number",
                    description: "Det første tallet som skal legges sammen."
                },
                tall2: {
                    type: "number",
                    description: "Det andre tallet som skal legges sammen."
                }
            },
            required: ["tall1", "tall2"]
            }
        }
    }


// Liste med funksjoner som kan brukes av Mistral
export const mistralFunctionTools: FunctionTool[] = [
    beskrivelseLeggSammenToTall
];

// Funksjonen som utfører selve operasjonen med å legge sammen to tall
function leggSammenToTall(args: {tall1: number, tall2: number}): number {
    return args.tall1 + args.tall2;
}

// Funksjon som tar imot funksjonsnavn og argumenter, og kaller riktig funksjon. Bygg ut etter behov.
export async function executeMistralfunksjon(functionName: string, args: { tall1: number; tall2: number }): Promise<number> {
    if (functionName === "leggSammenToTall") {
        const tall1 = Number(args.tall1);
        const tall2 = Number(args.tall2);
        const resultat = leggSammenToTall({ tall1, tall2 });
        return resultat;
    } else {
        throw new Error(`Ukjent funksjon: ${functionName}`);
    }
}
