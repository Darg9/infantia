import { getErrorMessage } from '../../../lib/error';

export type NormalizedErrorType = 'timeout' | 'blocked' | 'parse_error' | 'empty_response' | 'unknown';

export function classifyError(error: unknown): NormalizedErrorType {
  const message = (getErrorMessage(error) || String(error) || '').toLowerCase();
  const status = (error as { status?: number; response?: { status?: number } })?.status
    ?? (error as { status?: number; response?: { status?: number } })?.response?.status;

  if (message.includes('timeout') || message.includes('abort') || message.includes('connreset')) {
    return 'timeout';
  }
  if (status === 403 || status === 429 || message.includes('forbidden') || message.includes('captcha') || message.includes('rate limit')) {
    return 'blocked';
  }
  if (message.includes('parse') || message.includes('json') || message.includes('syntax')) {
    return 'parse_error';
  }
  if (message.includes('empty') || message.includes('no extractable')) {
    return 'empty_response';
  }
  return 'unknown';
}
