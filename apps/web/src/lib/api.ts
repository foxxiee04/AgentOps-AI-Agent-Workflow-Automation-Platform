const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    next: { revalidate: 10 }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

