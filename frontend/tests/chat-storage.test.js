import { describe, expect, it } from 'vitest';
import {
  createMessageId,
  createConversation,
  ensureUniqueMessageIds,
  getConversationStorageKey,
  getConversationTitle,
} from '../src/services/chatStorage';

describe('chat conversation helpers', () => {
  it('starts a new conversation with no messages', () => {
    const conversation = createConversation();

    expect(conversation.title).toBe('New chat');
    expect(conversation.messages).toEqual([]);
    expect(conversation.id).toMatch(/^chat-/);
  });

  it('creates a readable title from the first question', () => {
    expect(getConversationTitle('  How   do refunds work? ')).toBe('How do refunds work?');
    expect(getConversationTitle('a'.repeat(60))).toBe(`${'a'.repeat(45)}…`);
  });

  it('keeps saved conversations under separate signed-in customer keys', () => {
    expect(getConversationStorageKey('customer-a')).not.toBe(
      getConversationStorageKey('customer-b'),
    );
    expect(() => getConversationStorageKey('')).toThrow(
      'A signed-in customer is required to access chat history.',
    );
  });

  it('creates distinct message IDs across successive messages', () => {
    expect(createMessageId()).not.toBe(createMessageId());
  });

  it('repairs missing and duplicate message IDs in saved history', () => {
    const messages = ensureUniqueMessageIds([
      { id: '_r_5_-1', content: 'first' },
      { id: '_r_5_-1', content: 'duplicate' },
      { content: 'missing' },
    ]);

    expect(new Set(messages.map((message) => message.id)).size).toBe(3);
    expect(messages.map((message) => message.content)).toEqual([
      'first',
      'duplicate',
      'missing',
    ]);
  });
});
