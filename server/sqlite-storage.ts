import { IStorage } from "./interfaces";
import { User, Organization, CommuteLog, Listing, InsertUser } from "@shared/schema";
import Database from "better-sqlite3";
import session from "express-session";
import SQLiteStore from "connect-sqlite3";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import path from "path";
import fs from 'fs';

const scryptAsync = promisify(scrypt);
const SQLiteSession = SQLiteStore(session);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export class SQLiteStorage implements IStorage {
  private db: Database.Database | null = null;
  sessionStore: session.Store;

  constructor() {
    try {
      const dataDir = './data';
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      console.log('Initializing session store...');
      console.log('Session store path:', path.join(dataDir, "sessions.db"));
      
      this.sessionStore = new SQLiteSession({
        db: "sessions.db",
        dir: dataDir
      }) as session.Store;
      
      console.log('Session store initialized');
    } catch (error) {
      console.error('Error initializing session store:', error);
      throw error;
    }
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = './data';
      console.log('Data directory:', path.resolve(dataDir));
      
      if (!fs.existsSync(dataDir)) {
        console.log('Creating data directory...');
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const dbPath = path.join(dataDir, "carbon_credits.db");
      console.log('Database path:', path.resolve(dbPath));

      // Create a new database connection with write access
      this.db = new Database(dbPath);

      // Enable WAL mode and foreign keys
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      
      console.log('Database connection established');

      // Create tables if they don't exist
      console.log('Creating tables...');
      
      // Create tables one by one for better error handling
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL,
          organizationId INTEGER,
          commuteDistance TEXT
        )
      `);
      console.log('Users table created');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS organizations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          virtualBalance TEXT NOT NULL,
          totalCredits TEXT NOT NULL,
          status TEXT NOT NULL
        )
      `);
      console.log('Organizations table created');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS commute_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          date TEXT NOT NULL,
          method TEXT NOT NULL,
          pointsEarned TEXT NOT NULL,
          FOREIGN KEY (userId) REFERENCES users(id)
        )
      `);
      console.log('Commute logs table created');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS listings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          organizationId INTEGER NOT NULL,
          creditsAmount TEXT NOT NULL,
          pricePerCredit TEXT NOT NULL,
          status TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (organizationId) REFERENCES organizations(id)
        )
      `);
      console.log('Listings table created');

      // Create initial admin if not exists
      const admin = await this.getUserByUsername("admin");
      if (!admin) {
        console.log('Creating initial admin user...');
        await this.createInitialAdmin();
        console.log('Initial admin user created');
      }

      console.log('Database initialization completed successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async createInitialAdmin() {
    const adminUser = {
      username: "admin",
      password: await hashPassword("admin123"),
      name: "System Admin",
      role: "system_admin" as const,
      status: "approved" as const,
    };
    await this.createUser(adminUser);
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    if (!this.db) throw new Error("Database not initialized");
    const user = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!this.db) throw new Error("Database not initialized");
    const user = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as User | undefined;
    return user;
  }

  async getAllUsers(): Promise<Map<number, User>> {
    if (!this.db) throw new Error("Database not initialized");
    const users = this.db.prepare("SELECT * FROM users").all() as User[];
    return new Map(users.map(user => [user.id, user]));
  }

  async createUser(user: InsertUser): Promise<User> {
    if (!this.db) throw new Error("Database not initialized");
    const result = this.db.prepare(`
      INSERT INTO users (username, password, name, role, status, commuteDistance)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      user.username,
      user.password,
      user.name,
      user.role,
      user.status,
      user.commuteDistance?.toString() || null
    );
    
    const createdUser = await this.getUser(result.lastInsertRowid as number);
    if (!createdUser) throw new Error("Failed to create user");
    return createdUser;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    if (!this.db) throw new Error("Database not initialized");
    const setClauses = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];
    
    this.db.prepare(`
      UPDATE users SET ${setClauses} WHERE id = ?
    `).run(...values);
    
    const updatedUser = await this.getUser(id);
    if (!updatedUser) throw new Error("User not found");
    return updatedUser;
  }

  // Organization methods
  async getOrganization(id: number): Promise<Organization | undefined> {
    if (!this.db) throw new Error("Database not initialized");
    const org = this.db.prepare("SELECT * FROM organizations WHERE id = ?").get(id) as Organization | undefined;
    return org;
  }

  async getAllOrganizations(): Promise<Map<number, Organization>> {
    if (!this.db) throw new Error("Database not initialized");
    const orgs = this.db.prepare("SELECT * FROM organizations").all() as Organization[];
    return new Map(orgs.map(org => [org.id, org]));
  }

  async createOrganization(org: Partial<Organization>): Promise<Organization> {
    if (!this.db) throw new Error("Database not initialized");
    const result = this.db.prepare(`
      INSERT INTO organizations (name, description, virtualBalance, totalCredits, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      org.name,
      org.description || "",
      org.virtualBalance || "1000",
      org.totalCredits || "0",
      org.status || "pending"
    );
    
    const newOrg = await this.getOrganization(result.lastInsertRowid as number);
    if (!newOrg) throw new Error("Failed to create organization");
    return newOrg;
  }

  async updateOrganization(id: number, updates: Partial<Organization>): Promise<Organization> {
    if (!this.db) throw new Error("Database not initialized");
    const setClauses = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];
    
    this.db.prepare(`
      UPDATE organizations SET ${setClauses} WHERE id = ?
    `).run(...values);
    
    const updatedOrg = await this.getOrganization(id);
    if (!updatedOrg) throw new Error("Organization not found");
    return updatedOrg;
  }

  // Commute log methods
  async createCommuteLog(log: Partial<CommuteLog>): Promise<CommuteLog> {
    if (!this.db) throw new Error("Database not initialized");
    const result = this.db.prepare(`
      INSERT INTO commute_logs (userId, date, method, pointsEarned)
      VALUES (?, ?, ?, ?)
    `).run(
      log.userId,
      log.date,
      log.method,
      log.pointsEarned?.toString() || "0"
    );
    
    const newLog = this.db.prepare("SELECT * FROM commute_logs WHERE id = ?")
      .get(result.lastInsertRowid) as CommuteLog;
    if (!newLog) throw new Error("Failed to create commute log");
    return newLog;
  }

  async getUserCommuteLogs(userId: number): Promise<CommuteLog[]> {
    if (!this.db) throw new Error("Database not initialized");
    return this.db.prepare("SELECT * FROM commute_logs WHERE userId = ?")
      .all(userId) as CommuteLog[];
  }

  // Listing methods
  async createListing(listing: Partial<Listing>): Promise<Listing> {
    if (!this.db) throw new Error("Database not initialized");
    const result = this.db.prepare(`
      INSERT INTO listings (organizationId, creditsAmount, pricePerCredit, status, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      listing.organizationId,
      listing.creditsAmount?.toString() || "0",
      listing.pricePerCredit?.toString() || "0",
      listing.status || "active",
      listing.createdAt || new Date().toISOString()
    );
    
    const newListing = await this.getListing(result.lastInsertRowid as number);
    if (!newListing) throw new Error("Failed to create listing");
    return newListing;
  }

  async getActiveListings(): Promise<Listing[]> {
    if (!this.db) throw new Error("Database not initialized");
    return this.db.prepare("SELECT * FROM listings WHERE status = 'active'")
      .all() as Listing[];
  }

  async getListing(id: number): Promise<Listing | undefined> {
    if (!this.db) throw new Error("Database not initialized");
    const listing = this.db.prepare("SELECT * FROM listings WHERE id = ?")
      .get(id) as Listing | undefined;
    return listing;
  }

  async updateListing(id: number, updates: Partial<Listing>): Promise<Listing> {
    if (!this.db) throw new Error("Database not initialized");
    const setClauses = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];
    
    this.db.prepare(`
      UPDATE listings SET ${setClauses} WHERE id = ?
    `).run(...values);
    
    const updatedListing = await this.getListing(id);
    if (!updatedListing) throw new Error("Listing not found");
    return updatedListing;
  }
}

export const sqliteStorage = new SQLiteStorage(); 