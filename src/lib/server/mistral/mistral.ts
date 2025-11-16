import { env } from "$env/dynamic/private";
import { Mistral } from "@mistralai/mistralai";
import { createSse } from "$lib/streaming.js";
import type { MistralConversationConfig } from "$lib/types/agents.js";
import type { ConversationEvents } from "@mistralai/mistralai/models/components/conversationevents";
import type { EventStream } from "@mistralai/mistralai/lib/event-streams";
import type { ConversationResponse } from "@mistralai/mistralai/models/components/conversationresponse";

export const mistral = new Mistral({
  apiKey: env.MISTRAL_API_KEY,
});

export const handleMistralStream = (stream: EventStream<ConversationEvents>, conversationId?: string, userLibraryId?: string | null): ReadableStream => {
  const readableStream = new ReadableStream({
    async start (controller) {
      if (conversationId) {
        controller.enqueue(createSse({ event: 'conversation.started', data: { conversationId } }));
      }
      if (userLibraryId) {
        controller.enqueue(createSse({ event: 'conversation.vectorstore.created', data: { vectorStoreId: userLibraryId } }));
      }
      for await (const chunk of stream) {
        if (!['conversation.response.started', 'message.output.delta'].includes(chunk.event)) {
          console.log('Mistral stream chunk event:', chunk.event, chunk.data);
        }
        // Types are not connected to the event in mistral... so we use type instead
        switch (chunk.data.type) {
          case 'conversation.response.started':
            // controller.enqueue(createSse('conversation.started', { MistralConversationId: chunk.data.conversationId }));
            break
          case 'message.output.delta':
            controller.enqueue(createSse({ event: 'conversation.message.delta', data: { messageId: chunk.data.id, content: typeof chunk.data.content === 'string' ? chunk.data.content : 'FIKK EN CHUNK SOM IKKE ER STRING, sjekk mistral-typen OutputContentChunks' } }));
            break
          case 'conversation.response.done':
            console.log("Mistral conversation done event data:", chunk.data);
            controller.enqueue(createSse({ event: 'conversation.message.ended', data: { totalTokens: chunk.data.usage.totalTokens || 0 } }));
            break
          case 'conversation.response.error':
            controller.enqueue(createSse({ event: 'error', data: { message: chunk.data.message } }));
            break
          // Ta hensyn til flere event typer her etter behov
        }
      }
      controller.close()
    }
  })
  return readableStream;
}

export const appendToMistralConversation = async (conversationId: string, prompt: string, streamResponse: boolean): Promise<ConversationResponse | EventStream<ConversationEvents>> => {
  // Implementer tillegg av melding til samtale mot Mistral her
  if (streamResponse) {
    const stream = await mistral.beta.conversations.appendStream({
      conversationId,
      conversationAppendStreamRequest: {
        inputs: prompt,
      }
    });
    return stream;
  }
  const response = await mistral.beta.conversations.append({
    conversationId: conversationId,
    conversationAppendRequest: {
      inputs: prompt,
    }
  });
  return response;
}

type MistralConversationCreationResult = {
  mistralConversationId: string
  userLibraryId: string | null
  mistralStream?: EventStream<ConversationEvents>
  mistralResponse?: ConversationResponse
}

export const createMistralConversation = async (mistralConversationConfig: MistralConversationConfig, initialPrompt: string, streamResponse: boolean): Promise<MistralConversationCreationResult> => {
  // Sjekk at det ikke BÅDE er agentId og model satt i config, det er ikke lov
  if (mistralConversationConfig.agentId && mistralConversationConfig.model) {
    throw new Error("Cannot have both agentId and model set in MistralConversationConfig when creating a conversation");
  }

  const createConfig = async (): Promise<{ config: any; userLibraryId: string | null }> => {
    if (mistralConversationConfig.agentId) {
      return { config: { agentId: mistralConversationConfig.agentId, inputs: initialPrompt }, userLibraryId: null };
    }
    // Create a library for the user to upload files to
    const library = await mistral.beta.libraries.create({
      name: `Library for conversation - add something useful here`,
      description: 'Library created for conversation with document tools',
    })
    if (!mistralConversationConfig.tools) {
      mistralConversationConfig.tools = [];
    }
    const documentLibraryTool = mistralConversationConfig.tools.find(tool => tool.type === 'document_library');
    if (!documentLibraryTool) {
      mistralConversationConfig.tools.push({
        type: 'document_library',
        libraryIds: [library.id]
      });
    } else {
      documentLibraryTool.libraryIds.push(library.id);
    }
    return {
      config: {
        inputs: initialPrompt,
        ...mistralConversationConfig
      },
      userLibraryId: library.id
    }
  }

  const mistralConfig = await createConfig();

  if (streamResponse) {
    const conversationStarter = await mistral.beta.conversations.startStream(mistralConfig.config)

    // REMARK: Dirty hack to extract conversationId from stream - hopefully Mistral wont change this behaviour in a long long time...

    const [conversationStarterStream, actualStream] = conversationStarter.tee(); // Haha, lets create a tee so we can read it multiple time (creates two duplicate readable streams)
    
    // Then we extract the conversationId from the first stream, and pass the actualStream back (if it works...)
    const reader = conversationStarterStream.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (value?.data.type === 'conversation.response.started') {
        reader.cancel() // Vi trenger ikke lese mer her, vi har det vi trenger
        return { mistralConversationId: value.data.conversationId, userLibraryId: mistralConfig.userLibraryId, mistralStream: (actualStream) as EventStream<ConversationEvents> };
      }
      if (done) {
        break; // Oh no, vi fant ikke conversation response started event, har ikke noe å gå for... throw error under her
      }
    }
    throw new Error("Did not receive conversation started event from mistral, the dirty hack failed");
  }
  const conversationStarter = await mistral.beta.conversations.start(mistralConfig.config);

  return { mistralConversationId: conversationStarter.conversationId, userLibraryId: mistralConfig.userLibraryId, mistralResponse: conversationStarter };
}
