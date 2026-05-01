import { getErrorMessage } from '../../../lib/error';
import { createLogger } from '../../../lib/logger';
import { classifyError } from './classify-error';

const log = createLogger('scraping:resilience');

export interface FetchRetryResult {
  data: string;
  responseTime: number;
  methodUsed: string;
}

export async function fetchWithRetry(
  fetchFn: () => Promise<string>,
  methodName: string,
  maxRetries = 3
): Promise<FetchRetryResult> {
  let attempt = 1;
  const start = Date.now();

  while (attempt <= maxRetries) {
    try {
      const data = await fetchFn();
      
      if (!data || data.trim().length === 0) {
        throw new Error('empty_response');
      }

      return {
        data,
        responseTime: Date.now() - start,
        methodUsed: methodName,
      };
    } catch (error: unknown) {
      const errType = classifyError(error);
      const latency = Date.now() - start;

      log.info(JSON.stringify({
        event: 'scrape_retry',
        method: methodName,
        attempt,
        responseTime: latency,
        errorType: errType,
        message: getErrorMessage(error)
      }));

      if (attempt === maxRetries || errType === 'blocked') {
        throw error; // Al quedarse sin reintentos o recibir un hard block
      }
      
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(res => setTimeout(res, delay));
      attempt++;
    }
  }

  throw new Error('Agotados reintentos');
}
