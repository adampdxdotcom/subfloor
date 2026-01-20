import { getEndpoint } from '../utils/apiConfig';
import { MediaAsset } from '../types'; // We will add this type in the next step

/**
 * Fetches all media assets from the server.
 * Includes calculated usage counts.
 */
export const getMediaAssets = async (): Promise<MediaAsset[]> => {
  const response = await fetch(getEndpoint('/api/media'), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch media assets' }));
    throw new Error(errorData.error);
  }
  return response.json();
};

/**
 * Uploads a new media file.
 * @param formData - A FormData object containing the 'file' and 'category'.
 */
export const uploadMediaAsset = async (formData: FormData): Promise<MediaAsset> => {
  const response = await fetch(getEndpoint('/api/media'), {
    method: 'POST',
    body: formData,
    // Note: 'Content-Type' for FormData is set automatically by the browser
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to upload media asset' }));
    throw new Error(errorData.error);
  }
  return response.json();
};

/**
 * Deletes a media asset by its ID.
 * @param id - The UUID of the media asset to delete.
 */
export const deleteMediaAsset = async (id: string): Promise<void> => {
  const response = await fetch(getEndpoint(`/api/media/${id}`), {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to delete media asset' }));
    throw new Error(errorData.error);
  }
};