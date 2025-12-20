// services/materialOrderService.ts

import { MaterialOrder, ActivityLogEntry } from "../types"; // <-- MODIFIED: Added ActivityLogEntry
import { getEndpoint } from "../utils/apiConfig";

const getApiUrl = () => getEndpoint('/api/orders');

/**
 * Fetches all material orders from the API.
 */
export const getMaterialOrders = async (): Promise<MaterialOrder[]> => {
    const response = await fetch(getApiUrl());
    if (!response.ok) {
        throw new Error('Failed to fetch material orders.');
    }
    return response.json();
};

/**
 * Adds a new material order.
 * The payload should include projectId and line items with unit and totalCost.
 * @param {object} orderData - The order data from the form.
 * @param {number} orderData.projectId - The ID of the project.
 * @param {string | null} orderData.supplier - The supplier name.
 * @param {string | null} orderData.etaDate - The estimated arrival date.
 * @param {Array<{sampleId: number, quantity: number, unit: string | null, totalCost: number | null}>} orderData.lineItems - The line items.
 */
export const addMaterialOrder = async (orderData: any): Promise<MaterialOrder> => {
    const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
    });
    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || 'Failed to create material order');
    }
    return response.json();
};

/**
 * Updates an existing material order.
 * The payload should include supplier, etaDate, and line items with unit and totalCost.
 * @param {number} orderId - The ID of the order to update.
 * @param {object} orderData - The order data from the form.
 * @param {string | null} orderData.supplier - The supplier name.
 * @param {string | null} orderData.etaDate - The estimated arrival date.
 * @param {Array<{sampleId: number, quantity: number, unit: string | null, totalCost: number | null}>} orderData.lineItems - The line items.
 */
export const updateMaterialOrder = async (orderId: number, orderData: any): Promise<MaterialOrder> => {
    const response = await fetch(`${getApiUrl()}/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
    });
    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || 'Failed to update material order');
    }
    return response.json();
};

/**
 * Deletes an existing material order.
 * @param {number} orderId - The ID of the order to delete.
 */
export const deleteMaterialOrder = async (orderId: number): Promise<void> => {
    const response = await fetch(`${getApiUrl()}/${orderId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})); // Handle cases where body might be empty
        throw new Error(errorBody.error || 'Failed to delete material order');
    }
};

// =================================================================
//  NEW HISTORY FUNCTION
// =================================================================
/**
 * Fetches the activity history for a specific material order.
 * @param orderId The ID of the material order.
 * @returns A promise that resolves to an array of activity log entries.
 */
export const getMaterialOrderHistory = async (orderId: number): Promise<ActivityLogEntry[]> => {
    const response = await fetch(`${getApiUrl()}/${orderId}/history`);
    if (!response.ok) {
        throw new Error('Failed to fetch material order history.');
    }
    return response.json();
};
// =================================================================

export const receiveMaterialOrder = async (
  orderId: number, 
  data: { dateReceived: string; notes: string; sendEmailNotification: boolean; files?: FileList | null }
): Promise<MaterialOrder> => {
  
  // Convert to FormData to handle files
  const formData = new FormData();
  formData.append('dateReceived', data.dateReceived);
  formData.append('notes', data.notes);
  formData.append('sendEmailNotification', String(data.sendEmailNotification));
  
  if (data.files && data.files.length > 0) {
      Array.from(data.files).forEach(file => {
          formData.append('paperwork', file);
      });
  }

  const response = await fetch(`${getApiUrl()}/${orderId}/receive`, {
    method: 'POST',
    // NO 'Content-Type': 'application/json' header! 
    // Browser sets multipart/form-data boundary automatically when body is FormData
    body: formData,
  });

  if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Failed to receive material order');
  }
  return response.json();
};

export const reportMaterialOrderDamage = async (
  orderId: number, 
  data: { items: any[]; replacementEta: string; notes: string; sendEmailNotification: boolean; files?: FileList | null }
): Promise<{ originalOrder: MaterialOrder; replacementOrder: MaterialOrder }> => {
  
  // Convert to FormData
  const formData = new FormData();
  // Complex arrays/objects like 'items' must be stringified when appending to FormData
  formData.append('items', JSON.stringify(data.items));
  formData.append('replacementEta', data.replacementEta);
  formData.append('notes', data.notes);
  formData.append('sendEmailNotification', String(data.sendEmailNotification));

  if (data.files && data.files.length > 0) {
      Array.from(data.files).forEach(file => {
          formData.append('damagePhotos', file);
      });
  }

  const response = await fetch(`${getApiUrl()}/${orderId}/damage`, {
    method: 'POST',
    // No Content-Type header (browser sets boundary)
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Failed to report damage');
  }
  return response.json();
};