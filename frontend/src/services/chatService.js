import { fetch as expoFetch } from 'expo/fetch';
import { API_BASE_URL } from './api';
import { dispatchChatFrame } from './chatStreamEvents';

export async function streamChat(
  body,
  { token, signal, onProgress, onDelta } = {},
) {
  let response;
  try {
    response = await expoFetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      `Can't reach the GenTech API at ${API_BASE_URL}. Check that the backend is running and your phone is on the same Wi-Fi.`,
    );
  }

  if (!response.ok) {
    let message = `API request failed (${response.status})`;
    try {
      const errorBody = await response.json();
      if (typeof errorBody.detail === 'string') message = errorBody.detail;
    } catch {
      // Keep the HTTP status message when the server response is not JSON.
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const reader = response.body?.getReader?.();
  if (!reader) {
    throw new Error('The chat response does not support streaming.');
  }

  const decoder = new TextDecoder();
  const handlers = { onProgress, onDelta };
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let separator = buffer.match(/\r?\n\r?\n/);
    while (separator) {
      const frame = buffer.slice(0, separator.index);
      buffer = buffer.slice(separator.index + separator[0].length);
      const result = dispatchChatFrame(frame, handlers);
      if (result) {
        return result;
      }
      separator = buffer.match(/\r?\n\r?\n/);
    }
    if (done) break;
  }
  throw new Error('The chat stream ended before a complete response arrived.');
}
