// services/userService.ts

import { User, CurrentUser } from '../types';

// Define a simple Role type for clarity
export interface Role {
  id: number;
  name: string;
  description: string;
}

export const getUsers = async (): Promise<User[]> => {
  const response = await fetch('/api/users');
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  return response.json();
};

export const createUser = async (email: string, password: string): Promise<User> => {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to create user');
  }
  return response.json();
};

export const deleteUser = async (userId: string): Promise<void> => {
  const response = await fetch(`/api/users/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to delete user');
  }
};

export const getCurrentUser = async (): Promise<CurrentUser> => {
  const response = await fetch('/api/users/me');
  if (!response.ok) {
    throw new Error('Failed to fetch current user');
  }
  return response.json();
};

/**
 * Updates the current user's profile information (Name).
 */
export const updateUserProfile = async (firstName: string, lastName: string): Promise<{ firstName: string; lastName: string; avatarUrl: string | null }> => {
  const response = await fetch('/api/users/me/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to update profile');
  }
  return response.json();
};

/**
 * Uploads a profile picture for the current user.
 */
export const uploadUserAvatar = async (file: File): Promise<{ avatarUrl: string }> => {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch('/api/users/me/avatar', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to upload avatar');
  }
  return response.json();
};

/**
 * Deletes the current user's profile picture.
 */
export const deleteUserAvatar = async (): Promise<void> => {
  const response = await fetch('/api/users/me/avatar', {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete avatar');
  }
};

/**
 * Updates the current user's password.
 */
export const changeUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const response = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to change password');
    }
};

// =================================================================
//  NEW FUNCTIONS FOR ROLE MANAGEMENT
// =================================================================

/**
 * Fetches all available roles from the API.
 * @returns A promise that resolves to an array of Role objects.
 */
export const getRoles = async (): Promise<Role[]> => {
    const response = await fetch('/api/roles');
    if (!response.ok) {
        throw new Error('Failed to fetch roles');
    }
    return response.json();
};

/**
 * Updates the roles for a specific user.
 * @param userId The ID of the user to update.
 * @param roles An array of role names to assign to the user.
 * @returns A promise that resolves when the update is complete.
 */
export const updateUserRoles = async (userId: string, roles: string[]): Promise<void> => {
    const response = await fetch(`/api/users/${userId}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user roles');
    }
};