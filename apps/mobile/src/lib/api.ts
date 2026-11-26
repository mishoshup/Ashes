const configuredUrl: unknown = process.env.EXPO_PUBLIC_API_URL;
const API_URL = typeof configuredUrl === "string" ? configuredUrl : "http://localhost:8787";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError("Ashes can't reach the server right now.", 0);
  }

  if (!response.ok) {
    throw new ApiError("That didn't load. Try again.", response.status);
  }

  return response.json();
}
