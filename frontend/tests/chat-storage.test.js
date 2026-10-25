import { describe, expect, it } from 'vitest';
import { createConversation, getConversationTitle } from '../src/services/chatStorage';

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
});
