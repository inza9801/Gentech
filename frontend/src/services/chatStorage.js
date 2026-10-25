import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_STORAGE_KEY = 'gentech.ai.conversations.v1';
const MAX_CONVERSATIONS = 30;

export function getConversationStorageKey(customerId) {
  if (typeof customerId !== 'string' || !customerId.trim()) {
    throw new Error('A signed-in customer is required to access chat history.');
  }
  return `${CHAT_STORAGE_KEY}.${customerId}`;
}

export function createConversation() {
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'New chat',
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

export function getConversationTitle(question) {
  const title = question.trim().replace(/\s+/g, ' ');
  return title.length > 48 ? `${title.slice(0, 45)}…` : title || 'New chat';
}

export async function loadConversations(customerId) {
  const stored = await AsyncStorage.getItem(getConversationStorageKey(customerId));
  if (!stored) return [];
  const conversations = JSON.parse(stored);
  if (!Array.isArray(conversations)) {
    throw new Error('Saved chat history has an invalid format.');
  }
  return conversations
    .filter((conversation) =>
      conversation &&
      typeof conversation.id === 'string' &&
      typeof conversation.title === 'string' &&
      Array.isArray(conversation.messages),
    )
    .slice(0, MAX_CONVERSATIONS);
}

export async function saveConversations(conversations, customerId) {
  await AsyncStorage.setItem(
    getConversationStorageKey(customerId),
    JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)),
  );
}
