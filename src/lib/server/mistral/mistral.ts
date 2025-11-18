import { env } from "$env/dynamic/private";
import { Mistral } from "@mistralai/mistralai";
import { createSse } from "$lib/streaming.js";
import type { AgentConfig, Message } from "$lib/types/agents.js";
import type { ConversationEvents } from "@mistralai/mistralai/models/components/conversationevents";
import type { EventStream } from "@mistralai/mistralai/lib/event-streams";
import type { ConversationResponse } from "@mistralai/mistralai/models/components/conversationresponse";
import type { ConversationRequest, MessageInputEntry, MessageOutputEntry } from "@mistralai/mistralai/models/components";

export const mistral = new Mistral({
  apiKey: env["MISTRAL_API_KEY"] || 'bare-en-tulle-key',
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

type MistralConversationConfigResult = {
  requestConfig: ConversationRequest
  data: {
    userLibraryId: string | null
  }
}

const createMistralConversationConfig = async (agentConfig: AgentConfig, initialPrompt: string): Promise<MistralConversationConfigResult> => {
  if (agentConfig.type !== 'mistral-conversation' && agentConfig.type !== 'mistral-agent') {
    throw new Error(`Invalid agent config type for Mistral conversation: ${agentConfig.type}`);
  }
  // If simple agentId, use that and return
  if (agentConfig.type === 'mistral-agent') {
    return {
      requestConfig: {
        agentId: agentConfig.agentId,
        inputs: initialPrompt
      },
      data: {
        userLibraryId: null
      }
    };
  }
  // Now we know it's type mistral-conversation
  // If we fileSearchEnabled, we need to create a library for the user to upload files to
  const mistralConversationConfig: ConversationRequest = {
    model: agentConfig.model,
    inputs: initialPrompt,
    instructions: agentConfig.instructions || '',
    tools: [
      {
        type: 'document_library',
        libraryIds: [] as string[]
      }
    ]
  };
  // Just for reference
  const documentLibraryTool = mistralConversationConfig.tools!.find(tool => tool.type === 'document_library');
  
  // If file search is enabled, create a library for the user and add document_library tool
  let userLibraryId: string | null = null;
  if (agentConfig.fileSearchEnabled) {
    const userLibrary = await mistral.beta.libraries.create({
      name: `Library for conversation - add something useful here`,
      description: 'Library created for conversation with document tools'
    })
    userLibraryId = userLibrary.id;
    documentLibraryTool!.libraryIds.push(userLibrary.id);
  }
  // If preconfigured document libraries, add them as well
  if (agentConfig.documentLibraryIds && agentConfig.documentLibraryIds.length > 0) {
    documentLibraryTool!.libraryIds.push(...agentConfig.documentLibraryIds);
  }
  // If web search is enabled, add web_search tool
  if (agentConfig.webSearchEnabled) {
    throw new Error("Web search tool is not yet implemented for Mistral agents");
  }
  if (documentLibraryTool!.libraryIds.length === 0) {
    // Remove document library tool if no libraries are added
    mistralConversationConfig.tools = mistralConversationConfig.tools!.filter(tool => tool.type !== 'document_library');
  }
  return {
    requestConfig: mistralConversationConfig,
    data: {
      userLibraryId
    }
  };
}

type MistralConversationCreationResult = {
  mistralConversationId: string
  userLibraryId: string | null
  mistralStream?: EventStream<ConversationEvents>
  mistralResponse?: ConversationResponse
}

export const createMistralConversation = async (agentConfig: AgentConfig, initialPrompt: string, streamResponse: boolean): Promise<MistralConversationCreationResult> => {
  const mistralConversationConfig = await createMistralConversationConfig(agentConfig, initialPrompt);

  if (streamResponse) {
    const conversationStarter = await mistral.beta.conversations.startStream(mistralConversationConfig.requestConfig);
    // REMARK: Dirty hack to extract conversationId from stream - hopefully Mistral wont change this behaviour in a long long time...

    const [conversationStarterStream, actualStream] = conversationStarter.tee(); // Haha, lets create a tee so we can read it multiple time (creates two duplicate readable streams)
    
    // Then we extract the conversationId from the first stream, and pass the actualStream back (if it works...)
    const reader = conversationStarterStream.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (value?.data.type === 'conversation.response.started') {
        reader.cancel() // Vi trenger ikke lese mer her, vi har det vi trenger
        return { mistralConversationId: value.data.conversationId, userLibraryId: mistralConversationConfig.data.userLibraryId, mistralStream: (actualStream) as EventStream<ConversationEvents> };
      }
      if (done) {
        break; // Oh no, vi fant ikke conversation response started event, har ikke noe å gå for... throw error under her
      }
    }
    throw new Error("Did not receive conversation started event from mistral, the dirty hack failed");
  }

  throw new Error("Non-streaming Mistral conversation creation is not yet implemented");
  const conversationStarter = await mistral.beta.conversations.start(mistralConversationConfig.requestConfig);

  return { mistralConversationId: conversationStarter.conversationId, userLibraryId: mistralConversationConfig.data.userLibraryId, mistralResponse: conversationStarter };
}

export const getMistralConversationItems = async (mistralConversationId: string): Promise<Message[]> => {
  const conversationItems = await mistral.beta.conversations.getHistory({ conversationId: mistralConversationId }); // Får ascending order (tror jeg)
  // Vi tar først bare de som er message, og mapper de om til Message type vårt system bruker
  const messages = conversationItems.entries.filter(item => item.type === 'message.input' || item.type === 'message.output').map(item => {
    // Obs, kommer nok noe andre typer etterhvert
    item = item as MessageInputEntry | MessageOutputEntry;
    const newMessage: Message = {
      id: item.id || 'what-ingen-mistral-id',
      type: 'message',
      status: 'completed',
      role: item.type === 'message.input' && item.role === 'user' ? 'user' : 'agent',
      content: {
        type: item.type === 'message.input' ? 'inputText' : 'outputText',
        text: typeof item.content === 'string' ? item.content : 'FIKK EN CONTENT SOM IKKE ER STRING, sjekk mistral-typen OutputContent'
      }
    }
    return newMessage;
  })
  return messages;
}

