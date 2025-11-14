import { User, CurrentUser } from '../types'; // Import CurrentUser

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
    headers: {
      'Content-Type': 'application/json',
    },
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
    throw new Error('Failed to delete user');
  }
};

// --- NEW FUNCTION ---
export const getCurrentUser = async (): Promise<CurrentUser> => {
  const response = await fetch('/api/users/me');
  if (!response.ok) {
    throw new Error('Failed to fetch current user');
  }
  return response.json();
};