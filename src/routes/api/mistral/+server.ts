import { env } from '$env/dynamic/private'
import { Mistral } from '@mistralai/mistralai'
import { error } from '@sveltejs/kit'
import { writeFileSync } from 'fs'

const mistral = new Mistral({
  apiKey: env.MISTRAL_API_KEY
})

const model = 'mistral-small-latest'

const getMistralResponseStream = async (prompt, conversationId, messageId) => {
  console.log('getMistralResponseStream called with:', { prompt, conversationId, messageId })
  if (conversationId && messageId) {
    return await mistral.beta.conversations.restartStream({
      conversationId,
      conversationRestartStreamRequest: {
        inputs: prompt.toString(),
        fromEntryId: messageId
      }
    })
  }
  if (conversationId) {
    console.log('Appending to existing conversation:', conversationId)
    return await mistral.beta.conversations.appendStream({
      conversationId,
      conversationAppendStreamRequest: {
        inputs: prompt.toString()
      }
    })
  }
  return await mistral.beta.conversations.startStream({
    inputs: prompt.toString(),
    model,
    instructions: 'Answer in Norwegian'
  })
}

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const POST = async ({ request }) => {
  try {
    const { prompt, conversationId, messageId } = await request.json()

    console.log('Received promt:', prompt)
    console.log('Conversation ID:', conversationId)
    console.log('Message ID:', messageId)

    const stream = await getMistralResponseStream(prompt, conversationId, messageId)

    const readableStream = new ReadableStream({
      async start (controller) {
        for await (const chunk of stream) {
          switch (chunk.event) {
            case 'conversation.response.started':
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ conversationId: chunk.data.conversationId })}\n\n`))
              break
            case 'message.output.delta':
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ messageId: chunk.data.id, content: chunk.data.content })}\n\n`))
              break
          }
        }
        controller.close()
      }
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    })
  } catch (err) {
    throw error(500, `Error starting conversation: ${err.message}`)
  }
}
