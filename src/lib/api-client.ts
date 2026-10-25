export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    /** Per-field messages from form validation */
    public fields?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError("You seem to be offline. Check your connection and try again.", "OFFLINE", 0);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = body?.error;
    throw new ApiError(
      error?.message || `Request failed (${res.status})`,
      error?.code || "UNKNOWN",
      res.status,
      error?.fields
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
