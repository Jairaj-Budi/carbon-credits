import { sqliteStorage } from './sqlite-storage';
import fs from 'fs';
import path from 'path';

export async function initializeDatabase() {
  // Ensure data directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize SQLite storage
  await sqliteStorage.initialize();
  console.log('Database initialized successfully');
  
  return sqliteStorage;
}

export { sqliteStorage }; 