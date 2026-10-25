import { describe, expect, it, vi } from 'vitest';
import { dispatchChatFrame } from '../src/services/chatStreamEvents';

describe('chat stream events', () => {
  it('dispatches progress and token events and returns the final response', () => {
    const onProgress = vi.fn();
    const onDelta = vi.fn();
    const handlers = { onProgress, onDelta };

    expect(
      dispatchChatFrame(
        'event: progress\ndata: {"message":"Searching policies"}',
        handlers,
      ),
    ).toBeNull();
    expect(
      dispatchChatFrame('event: delta\ndata: {"text":"Hello"}', handlers),
    ).toBeNull();
    const final = dispatchChatFrame(
      'event: done\ndata: {"answer":"Hello there","sources":[]}',
      handlers,
    );

    expect(onProgress).toHaveBeenCalledWith('Searching policies');
    expect(onDelta).toHaveBeenCalledWith('Hello');
    expect(final).toEqual({ answer: 'Hello there', sources: [] });
  });

  it('surfaces stream errors as errors', () => {
    expect(() =>
      dispatchChatFrame(
        'event: error\ndata: {"message":"Chat unavailable"}',
        {},
      ),
    ).toThrow('Chat unavailable');
  });
});
