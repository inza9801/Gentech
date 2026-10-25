export function dispatchChatFrame(frame, handlers) {
  let eventName = 'message';
  const data = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart());
    }
  }
  if (!data.length) return null;

  const payload = JSON.parse(data.join('\n'));
  if (eventName === 'progress') handlers.onProgress?.(payload.message);
  if (eventName === 'delta') handlers.onDelta?.(payload.text);
  if (eventName === 'error') throw new Error(payload.message);
  return eventName === 'done' ? payload : null;
}
