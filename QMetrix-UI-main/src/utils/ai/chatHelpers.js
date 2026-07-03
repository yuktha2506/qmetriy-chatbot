export const normalizeChatMessage = (message = {}) => ({
  role: message.role || 'assistant',
  content: message.content || '',
});
