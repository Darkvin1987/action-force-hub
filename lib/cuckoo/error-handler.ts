export class CuckooApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly resultCode?: string
  ) {
    super(message);
    this.name = "CuckooApiError";
  }
}

export function getHttpErrorMessage(status: number): string {
  const errors: Record<number, string> = {
    400: "Validation error.",
    401: "Authentication failed.",
    404: "API endpoint not found.",
    409: "Request not allowed in current state.",
    500: "CUCKOO internal server error.",
    502: "CUCKOO upstream service error.",
    503: "CUCKOO service unavailable or under maintenance.",
    504: "CUCKOO request timed out.",
  };

  return errors[status] || `HTTP error ${status}`;
}