import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_STORAGE_KEY = 'gentech.ai.conversations.v1';
const MAX_CONVERSATIONS = 30;

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

export async function loadConversations() {
  const stored = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
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

export async function saveConversations(conversations) {
  await AsyncStorage.setItem(
    CHAT_STORAGE_KEY,
    JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)),
  );
}
