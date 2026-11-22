/**
 * File picker `accept` for chat attachments. Only a hint for the browser: the upload route sniffs
 * every file's bytes (ALLOWED_CHAT_ATTACHMENT_TYPES in fileValidation.ts) and rejects the rest.
 */
export const CHAT_ATTACHMENT_ACCEPT =
  'image/*,video/*,audio/*,.heic,.heif,.mkv,.avi,.3gp,.m4a,.aac,.flac,application/pdf,.docx,.xlsx,.pptx,.txt,.csv,text/plain,text/csv';
