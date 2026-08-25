export type ModelAvailability = 'available' | 'missing' | 'error';

export type FetchModel = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface ModelAvailabilityCoordination {
  eager: boolean;
  startLoading(): void;
}

export interface ModelSourceTarget {
  src: string | null;
  updateComplete: Promise<unknown>;
}

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

export async function coordinateModelAvailability(
  url: string,
  coordination: ModelAvailabilityCoordination,
  fetchModel: FetchModel = fetch,
): Promise<ModelAvailability> {
  const availabilityPromise = checkModelAvailability(url, fetchModel);

  if (coordination.eager) {
    coordination.startLoading();
  }

  const availability = await availabilityPromise;
  if (availability === 'available' && !coordination.eager) {
    coordination.startLoading();
  }

  return availability;
}

export async function assignModelSourceAfterUpdate(
  viewer: ModelSourceTarget,
  source: string,
): Promise<void> {
  await viewer.updateComplete;
  viewer.src = source;
}
