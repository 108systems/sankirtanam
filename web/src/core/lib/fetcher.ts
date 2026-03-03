export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `REQUEST_FAILED_${response.status}`;

    const error = new Error(message) as Error & {
      status?: number;
      payload?: unknown;
    };

    error.status = response.status;
    error.payload = payload;

    throw error;
  }

  return payload as T;
}

export async function fetcher<T>(url: string): Promise<T> {
  return requestJson<T>(url);
}
