import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = express();
const PORT = process.env.PORT || 3001;

// Types
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  gender: 'male' | 'female';
  team: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
  age: number;
  gender: 'male' | 'female';
  team: string;
}

interface BulkActionRequest {
  ids: number[];
}

// Middleware
server.use(cors());
server.use(express.json());

// Path to users data file
const USERS_FILE = path.join(__dirname, '../app/data/users.json');

// Helper function to read users
async function readUsers(): Promise<User[]> {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users file:', error);
    return [];
  }
}

// Helper function to write users
async function writeUsers(users: User[]): Promise<void> {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error writing users file:', error);
    throw error;
  }
}

// Routes
// Get all users with pagination
server.get('/api/users', async (req, res) => {
  try {
    const users = await readUsers();
    
    // Sort by id descending (newest first)
    users.sort((a, b) => b.id - a.id);
    
    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedUsers = users.slice(startIndex, endIndex);
    const totalPages = Math.ceil(users.length / limit);
    
    res.json({
      users: paginatedUsers,
      pagination: {
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
        total: users.length
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user by ID
// @ts-ignore
server.get('/api/users/:id', async (req, res) => {
  try {
    const users = await readUsers();
    const user = users.find(u => u.id === parseInt(req.params.id));
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Create new user
// @ts-ignore
server.post('/api/users', async (req, res) => {
  try {
    const { name, email, age, gender, team } = req.body as CreateUserRequest;
    
    // Validation
    if (!name || !email || !age || !gender || !team) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const users = await readUsers();
    
    // Check if email already exists
    if (users.some(user => user.email === email)) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Generate new ID
    const maxId = users.length > 0 ? Math.max(...users.map(u => u.id)) : 0;
    const newUser: User = {
      id: maxId + 1,
      name,
      email,
      age,
      gender,
      team
    };
    
    users.push(newUser);
    await writeUsers(users);
    
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
// @ts-ignore
server.put('/api/users/:id', async (req, res) => {
  try {
    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === parseInt(req.params.id));
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { name, email, age, gender, team } = req.body as CreateUserRequest;
    
    // Validation
    if (!name || !email || !age || !gender || !team) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if email already exists (excluding current user)
    if (users.some(user => user.email === email && user.id !== parseInt(req.params.id))) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Update user
    users[userIndex] = {
      ...users[userIndex],
      name,
      email,
      age,
      gender,
      team
    };
    
    await writeUsers(users);
    res.json(users[userIndex]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Bulk delete users
// @ts-ignore
server.delete('/api/users', async (req, res) => {
  try {
    const { ids } = req.body as BulkActionRequest;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'IDs array is required' });
    }
    
    const users = await readUsers();
    const filteredUsers = users.filter(user => !ids.includes(user.id));
    
    await writeUsers(filteredUsers);
    res.json({ message: `Successfully deleted ${ids.length} user(s)` });
  } catch (error) {
    console.error('Error deleting users:', error);
    res.status(500).json({ error: 'Failed to delete users' });
  }
});

// Bulk duplicate users
// @ts-ignore
server.post('/api/users/duplicate', async (req, res) => {
  try {
    const { ids } = req.body as BulkActionRequest;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'IDs array is required' });
    }
    
    const users = await readUsers();
    const usersToDuplicate = users.filter(user => ids.includes(user.id));
    
    if (usersToDuplicate.length === 0) {
      return res.status(404).json({ error: 'No users found to duplicate' });
    }
    
    // Generate new IDs for duplicated users
    const maxId = Math.max(...users.map(u => u.id));
    const duplicatedUsers = usersToDuplicate.map((user, index) => ({
      ...user,
      id: maxId + index + 1,
      email: `${user.email}`
    }));
    
    users.push(...duplicatedUsers);
    await writeUsers(users);
    
    res.json({ 
      message: `Successfully duplicated ${ids.length} user(s)`,
      duplicatedUsers 
    });
  } catch (error) {
    console.error('Error duplicating users:', error);
    res.status(500).json({ error: 'Failed to duplicate users' });
  }
});

server.listen(PORT, () => {
  console.log(`API Server is running on port ${PORT}`);
});