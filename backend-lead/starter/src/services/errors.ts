/** A deliberately safe error shape for expected business-rule failures. */
export class DomainError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, string>,
  ) {
    super(code);
    this.name = 'DomainError';
  }
}
