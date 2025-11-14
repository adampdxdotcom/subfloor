import { Customer, ActivityLogEntry } from "../types";

const API_BASE_URL = '/api/customers';

/**
 * Fetches all customers from the API.
 */
export const getCustomers = async (): Promise<Customer[]> => {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch customers.');
    }
    return response.json();
};

/**
 * Adds a new customer.
 * @param customerData The customer data to add, without id or createdAt.
 * @returns The newly created customer from the database.
 */
export const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'jobs'>): Promise<Customer> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
    });
    if (!response.ok) {
        throw new Error('Failed to create customer.');
    }
    return response.json();
};

/**
 * Updates an existing customer.
 * @param customer The full customer object including the ID.
 * @returns The updated customer from the database.
 */
export const updateCustomer = async (customer: Customer): Promise<Customer> => {
    const response = await fetch(`${API_BASE_URL}/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
    });
    if (!response.ok) {
        throw new Error('Failed to update customer.');
    }
    return response.json();
};

/**
 * Deletes a customer by their ID.
 * @param customerId The ID of the customer to delete.
 */
export const deleteCustomer = async (customerId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${customerId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        // If the server sent a specific error message, use it.
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete customer.');
    }
    // A successful DELETE returns a 204 No Content, so we don't return anything.
};

/**
 * Fetches the activity history for a specific customer.
 * @param customerId The ID of the customer.
 * @returns A promise that resolves to an array of activity log entries.
 */
export const getCustomerHistory = async (customerId: number): Promise<ActivityLogEntry[]> => {
    const response = await fetch(`${API_BASE_URL}/${customerId}/history`);
    if (!response.ok) {
        throw new Error('Failed to fetch customer history.');
    }
    return response.json();
};