import { AsyncLocalStorage } from 'async_hooks';

interface RequestContextData {
  userId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextData>();
