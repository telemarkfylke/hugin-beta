import { env } from "$env/dynamic/private";
import { Ollama, type ChatResponse } from 'ollama'
import { MessageOriginator, type Conversation, type ConversationMessage, type OllamaAIResponseConfig } from "$lib/types/agents";
import { createSse } from "$lib/streaming.js";


type OllamaResponse = ChatResponse | any

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' })

export type OllamaCreateResponse = {
  ollamaConversationId: string,
  response: OllamaResponse | any,
  messages: ConversationMessage[]
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

      addMessage(message, conversation.messages, MessageOriginator.Bot)
      controller.close()
    }
  })
  return readableStream;
}

type OllamaMessage = {
  role:string,
  content: string
}

const addMessage = (prompt: string, messages: ConversationMessage[], originator: MessageOriginator) => {
  if(!messages){
    messages = []
  }
  messages.push({ originator: originator, message: prompt })
}

const makeOllamaInstance = async(ollamaResponseConfig: OllamaAIResponseConfig, messages: OllamaMessage[], streamResponse: boolean): Promise<OllamaResponse | any> => {
  /*
   Dette er snedig, istedenfor multiple response verdier har de haller laget hardkodede versjoner av 
   chat for stream er enten true eller false, men det er ikke en boolean
  */  
  const response = streamResponse ?  await ollama.chat({
    model: 'gemma3',
    messages: messages,
    stream: true
  }) : await ollama.chat({
    model: 'gemma3',
    messages: messages,
    stream: false
  })

  return response
}

export const createOllamaConversation = async (ollamaResponseConfig: OllamaAIResponseConfig, prompt: string, streamResponse: boolean): Promise<OllamaCreateResponse> => {
  const messages: ConversationMessage[] = []
  addMessage(prompt, messages, MessageOriginator.User)
  const ollamaMessages:OllamaMessage[] = messages.map((value:ConversationMessage ) => { return { role: value.originator, content: value.message} })
  const response =  await makeOllamaInstance(ollamaResponseConfig, ollamaMessages, streamResponse)
  const reply: OllamaCreateResponse = {
    ollamaConversationId: crypto.randomUUID(),
    response: response,
    messages: messages 
  }
  return reply
}

export const appendToOllamaConversation = async (ollamaResponseConfig: OllamaAIResponseConfig, conversation: Conversation, prompt: string, streamResponse: boolean): Promise<OllamaResponse> => {  
  addMessage(prompt, conversation.messages, MessageOriginator.User)
  const ollamaMessages:OllamaMessage[] = conversation.messages.map((value:ConversationMessage ) => { return { role: value.originator, content: value.message} })  
  const response =  await makeOllamaInstance(ollamaResponseConfig, ollamaMessages, streamResponse)
  return response  
}