// API utility for frontend to call Express server
const API_BASE_URL = 'http://localhost:3001/api';

export interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  gender: 'male' | 'female';
  team: string;
}

export interface PaginatedUsersResponse {
  users: User[];
  pagination: {
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    total: number;
  };
}

// Get users with pagination
export async function getUsers(page = 1, limit = 5): Promise<PaginatedUsersResponse> {
  const response = await fetch(`${API_BASE_URL}/users?page=${page}&limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  return response.json();
}

// Get single user
export async function getUser(id: number): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/users/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
}

// Create user
export async function createUser(userData: Omit<User, 'id'>): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create user');
  }
  
  return response.json();
}

// Update user
export async function updateUser(id: number, userData: Omit<User, 'id'>): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update user');
  }
  
  return response.json();
}

// Delete users
export async function deleteUsers(ids: number[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete users');
  }
}

// Duplicate users
export async function duplicateUsers(ids: number[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/duplicate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to duplicate users');
  }
}
