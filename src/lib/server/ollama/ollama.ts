import { Ollama, type ChatResponse } from 'ollama'
import { type Conversation, type Message, type OllamaAIResponseConfig } from "$lib/types/agents";
import { createSse } from "$lib/streaming.js";


type OllamaResponse = ChatResponse | any

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' })

export type OllamaCreateResponse = {
  ollamaConversationId: string,
  response: OllamaResponse | any,
  messages: Message[]
}


export const handleOllamaStream = (conversation: Conversation, stream: any, conversationId?: string): ReadableStream | null => {
  const readableStream = new ReadableStream({
    async start(controller) {
      let message = ''
      const messageId = crypto.randomUUID()

      if (conversationId) {
        controller.enqueue(createSse({ event: 'conversation.started', data: { conversationId } }));
      }
      
      for await (const part of stream) {
        controller.enqueue(createSse({ event: 'conversation.message.delta', data: { messageId: messageId, content: part.message.content } }));
        message += part.message.content
      }

      addMessage(message, conversation.messages, 'assistant', 'outputText')
      controller.close()
    }
  })
  return readableStream;
}

type OllamaMessage = {
  role:string,
  content: string
}

const addMessage = (prompt: string, messages: Message[], originator: 'user' | 'assistant', contentType: 'inputText' | 'outputText', ) => {
  if(!messages){
    messages = []
  }
  const msg: Message = {
    id: crypto.randomUUID(),
    type: 'message',
    status: 'completed',
    role: originator,
    content: {
      text: prompt,
      type: contentType
    }
  }
  messages.push(msg)
}

const makeOllamaInstance = async(ollamaResponseConfig: OllamaAIResponseConfig, messages: OllamaMessage[], streamResponse: boolean): Promise<OllamaResponse | any> => {
  /*
   Dette er snedig, istedenfor multiple response verdier har de haller laget hardkodede versjoner av 
   chat for stream er enten true eller false, men det er ikke en boolean
  */  
  const response = streamResponse ?  await ollama.chat({
    model: ollamaResponseConfig.model,
    messages: messages,
    stream: true
  }) : await ollama.chat({
    model: ollamaResponseConfig.model,
    messages: messages,
    stream: false
  })

  return response
}

export const createOllamaConversation = async (ollamaResponseConfig: OllamaAIResponseConfig, prompt: string, streamResponse: boolean): Promise<OllamaCreateResponse> => {
  const messages: Message[] = []
  addMessage(prompt, messages, 'user', 'inputText')
  const ollamaMessages:OllamaMessage[] = messages.map((value:Message ) => { return { role: value.role, content: value.content.text } })
  const response =  await makeOllamaInstance(ollamaResponseConfig, ollamaMessages, streamResponse)
  const reply: OllamaCreateResponse = {
    ollamaConversationId: crypto.randomUUID(),
    response: response,
    messages: messages 
  }
  return reply
}

export const appendToOllamaConversation = async (ollamaResponseConfig: OllamaAIResponseConfig, conversation: Conversation, prompt: string, streamResponse: boolean): Promise<OllamaResponse> => {  
  addMessage(prompt, conversation.messages, 'user', 'inputText')
  const ollamaMessages:OllamaMessage[] = conversation.messages.map((value:Message ) => { return { role: value.role, content: value.content.text } })  
  const response =  await makeOllamaInstance(ollamaResponseConfig, ollamaMessages, streamResponse)
  return response  
}