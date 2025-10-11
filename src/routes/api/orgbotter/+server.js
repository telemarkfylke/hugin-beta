/**
 * OrgBotter API-endepunkt
 *
 * Oppretter ChatKit-session ved å proxy-e forespørsler til OpenAI ChatKit Sessions API.
 * Dette holder API-nøkkelen sikker på server-side og returnerer kun client_secret til frontend.
 *
 * @param {Object} request.body - Request body
 * @param {string} request.body.deviceId - Unik bruker/enhet-identifikator
 * @param {string} [request.body.workflow] - Valgfri workflow ID (bruker AGENT_WORKFLOW som default)
 * @returns {Object} { client_secret: string } - Autentiseringsnøkkel for ChatKit
 */

import { OPENAI_API_KEY_LABS, AGENT_WORKFLOW } from '$env/static/private';

export async function POST({ request }) {
  try {
    const { deviceId, workflow } = await request.json();

    // Bruk standard workflow hvis ingen er spesifisert
    const workflowId = workflow || AGENT_WORKFLOW;
    console.log('Creating session with workflow:', workflowId);

    // Kall OpenAI ChatKit Sessions API
    const response = await fetch('https://api.openai.com/v1/chatkit/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'chatkit_beta=v1',  // Beta API-versjon påkrevd
        'Authorization': `Bearer ${OPENAI_API_KEY_LABS}`
      },
      body: JSON.stringify({
        workflow: { id: workflowId },
        user: deviceId
      })
    });

    const data = await response.json();
    console.log('Response data:', data);

    // Håndter API-feil
    if (!response.ok) {
      return new Response(JSON.stringify({
        error: data.error || 'API request failed',
        details: data
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Returner kun client_secret til frontend (ikke hele responsen)
    return new Response(JSON.stringify({
      client_secret: data.client_secret
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('OrgBotter API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
