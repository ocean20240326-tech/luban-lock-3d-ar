export type ModelAvailability = 'available' | 'missing' | 'error';

export type FetchModel = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function checkModelAvailability(
  url: string,
  fetchModel: FetchModel = fetch,
): Promise<ModelAvailability> {
  try {
    const response = await fetchModel(url, {
      method: 'HEAD',
      cache: 'no-store',
    });

    if (!response.ok) {
      return response.status === 404 ? 'missing' : 'error';
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    return contentType.includes('text/html') ? 'missing' : 'available';
  } catch {
    return 'error';
  }
}
