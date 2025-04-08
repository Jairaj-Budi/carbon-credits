import { IStorage } from "./interfaces";
import { User, Organization, CommuteLog, Listing, InsertUser } from "@shared/schema";
import { Database } from "sqlite3";
import { open, Database as SQLiteDB } from "sqlite";
import session from "express-session";
import SQLiteStore from "connect-sqlite3";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import path from "path";

const scryptAsync = promisify(scrypt);
const SQLiteSession = SQLiteStore(session);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export class SQLiteStorage implements IStorage {
  private db: SQLiteDB | null = null;
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new SQLiteSession({
      db: "sessions.db",
      dir: "./data",
    });
  }

  async initialize() {
    // Ensure data directory exists
    const dataDir = "./data";
    
    this.db = await open({
      filename: path.join(dataDir, "carbon_credits.db"),
      driver: Database
    });

    // Create tables if they don't exist
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        organizationId INTEGER,
        commuteDistance TEXT
      );

      CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        virtualBalance TEXT NOT NULL,
        totalCredits TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS commute_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        pointsEarned TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organizationId INTEGER NOT NULL,
        creditsAmount TEXT NOT NULL,
        pricePerCredit TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (organizationId) REFERENCES organizations(id)
      );
    `);

    // Create initial admin if not exists
    const admin = await this.getUserByUsername("admin");
    if (!admin) {
      await this.createInitialAdmin();
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
    const user = await this.db.get<User>("SELECT * FROM users WHERE id = ?", id);
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!this.db) throw new Error("Database not initialized");
    const user = await this.db.get<User>(
      "SELECT * FROM users WHERE username = ?",
      username
    );
    return user || undefined;
  }

  async getAllUsers(): Promise<Map<number, User>> {
    if (!this.db) throw new Error("Database not initialized");
    const users = await this.db.all<User[]>("SELECT * FROM users");
    return new Map(users.map(user => [user.id, user]));
  }

  async createUser(user: InsertUser): Promise<User> {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db.run(
      `INSERT INTO users (username, password, name, role, status, commuteDistance)
       VALUES (?, ?, ?, ?, ?, ?)`,
      user.username,
      user.password,
      user.name,
      user.role,
      user.status,
      user.commuteDistance?.toString() || null
    );
    return {
      ...user,
      id: result.lastID!,
      commuteDistance: user.commuteDistance?.toString() || null,
    } as User;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    if (!this.db) throw new Error("Database not initialized");
    const setClauses = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];
    
    await this.db.run(
      `UPDATE users SET ${setClauses} WHERE id = ?`,
      ...values
    );
    
    const updatedUser = await this.getUser(id);
    if (!updatedUser) throw new Error("User not found");
    return updatedUser;
  }

  // Organization methods
  async getOrganization(id: number): Promise<Organization | undefined> {
    if (!this.db) throw new Error("Database not initialized");
    const org = await this.db.get<Organization>(
      "SELECT * FROM organizations WHERE id = ?",
      id
    );
    return org || undefined;
  }

  async getAllOrganizations(): Promise<Map<number, Organization>> {
    if (!this.db) throw new Error("Database not initialized");
    const orgs = await this.db.all<Organization[]>("SELECT * FROM organizations");
    return new Map(orgs.map(org => [org.id, org]));
  }

  async createOrganization(org: Partial<Organization>): Promise<Organization> {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db.run(
      `INSERT INTO organizations (name, description, virtualBalance, totalCredits, status)
       VALUES (?, ?, ?, ?, ?)`,
      org.name,
      org.description || "",
      org.virtualBalance || "1000",
      org.totalCredits || "0",
      org.status || "pending"
    );
    
    const newOrg = await this.getOrganization(result.lastID!);
    if (!newOrg) throw new Error("Failed to create organization");
    return newOrg;
  }

  async updateOrganization(id: number, updates: Partial<Organization>): Promise<Organization> {
    if (!this.db) throw new Error("Database not initialized");
    const setClauses = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];
    
    await this.db.run(
      `UPDATE organizations SET ${setClauses} WHERE id = ?`,
      ...values
    );
    
    const updatedOrg = await this.getOrganization(id);
    if (!updatedOrg) throw new Error("Organization not found");
    return updatedOrg;
  }

  // Commute log methods
  async createCommuteLog(log: Partial<CommuteLog>): Promise<CommuteLog> {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db.run(
      `INSERT INTO commute_logs (userId, date, type, pointsEarned)
       VALUES (?, ?, ?, ?)`,
      log.userId,
      log.date,
      log.type,
      log.pointsEarned?.toString() || "0"
    );
    
    const newLog = await this.db.get<CommuteLog>(
      "SELECT * FROM commute_logs WHERE id = ?",
      result.lastID
    );
    if (!newLog) throw new Error("Failed to create commute log");
    return newLog;
  }

  async getUserCommuteLogs(userId: number): Promise<CommuteLog[]> {
    if (!this.db) throw new Error("Database not initialized");
    return this.db.all<CommuteLog[]>(
      "SELECT * FROM commute_logs WHERE userId = ?",
      userId
    );
  }

  // Listing methods
  async createListing(listing: Partial<Listing>): Promise<Listing> {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db.run(
      `INSERT INTO listings (organizationId, creditsAmount, pricePerCredit, status, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      listing.organizationId,
      listing.creditsAmount?.toString() || "0",
      listing.pricePerCredit?.toString() || "0",
      listing.status || "active",
      listing.createdAt || new Date().toISOString()
    );
    
    const newListing = await this.getListing(result.lastID!);
    if (!newListing) throw new Error("Failed to create listing");
    return newListing;
  }

  async getActiveListings(): Promise<Listing[]> {
    if (!this.db) throw new Error("Database not initialized");
    return this.db.all<Listing[]>(
      "SELECT * FROM listings WHERE status = 'active'"
    );
  }

  async getListing(id: number): Promise<Listing | undefined> {
    if (!this.db) throw new Error("Database not initialized");
    const listing = await this.db.get<Listing>(
      "SELECT * FROM listings WHERE id = ?",
      id
    );
    return listing || undefined;
  }

  async updateListing(id: number, updates: Partial<Listing>): Promise<Listing> {
    if (!this.db) throw new Error("Database not initialized");
    const setClauses = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), id];
    
    await this.db.run(
      `UPDATE listings SET ${setClauses} WHERE id = ?`,
      ...values
    );
    
    const updatedListing = await this.getListing(id);
    if (!updatedListing) throw new Error("Listing not found");
    return updatedListing;
  }
}

export const sqliteStorage = new SQLiteStorage(); 