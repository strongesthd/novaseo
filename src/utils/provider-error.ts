export class ProviderError extends Error {
  constructor(public readonly code: string, public readonly platform: string, public readonly retryable: boolean, public readonly requestId?: string) {
    super(code);
    this.name = 'ProviderError';
  }
}
