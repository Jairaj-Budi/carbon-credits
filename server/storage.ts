import { IStorage } from "./interfaces";
import { User, Organization, CommuteLog, Listing, InsertUser } from "@shared/schema";
import createMemoryStore from "memorystore";
import session from "express-session";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const MemoryStore = createMemoryStore(session);
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private organizations: Map<number, Organization>;
  private commuteLogs: Map<number, CommuteLog>;
  private listings: Map<number, Listing>;
  private currentIds: { [key: string]: number };
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.organizations = new Map();
    this.commuteLogs = new Map();
    this.listings = new Map();
    this.currentIds = {
      users: 1,
      organizations: 1,
      commuteLogs: 1,
      listings: 1,
    };
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    // Create initial system admin with hashed password
    this.createInitialAdmin();
  }

  private async createInitialAdmin() {
    const adminUser = {
      username: "admin",
      password: await hashPassword("admin123"),
      name: "System Admin",
      role: "system_admin" as const,
      status: "approved" as const,
    };
    this.createUser(adminUser);
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getAllUsers(): Promise<Map<number, User>> {
    return this.users;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.currentIds.users++;
    const newUser = { 
      ...user, 
      id,
      commuteDistance: user.commuteDistance ? user.commuteDistance.toString() : null,
    } as User;
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Organization methods
  async getOrganization(id: number): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  async getAllOrganizations(): Promise<Map<number, Organization>> {
    return this.organizations;
  }

  async createOrganization(org: Partial<Organization>): Promise<Organization> {
    const id = this.currentIds.organizations++;
    const newOrg = {
      id,
      virtualBalance: "1000",
      totalCredits: "0",
      status: "pending",
      ...org,
    } as Organization;
    this.organizations.set(id, newOrg);
    return newOrg;
  }

  async updateOrganization(id: number, updates: Partial<Organization>): Promise<Organization> {
    const org = this.organizations.get(id);
    if (!org) throw new Error("Organization not found");
    const updatedOrg = { ...org, ...updates };
    this.organizations.set(id, updatedOrg);
    return updatedOrg;
  }

  // Commute log methods
  async createCommuteLog(log: Partial<CommuteLog>): Promise<CommuteLog> {
    const id = this.currentIds.commuteLogs++;
    const newLog = { 
      id, 
      ...log,
      pointsEarned: log.pointsEarned?.toString() ?? "0",
    } as CommuteLog;
    this.commuteLogs.set(id, newLog);
    return newLog;
  }

  async getUserCommuteLogs(userId: number): Promise<CommuteLog[]> {
    return Array.from(this.commuteLogs.values()).filter(
      (log) => log.userId === userId,
    );
  }

  // Listing methods
  async createListing(listing: Partial<Listing>): Promise<Listing> {
    const id = this.currentIds.listings++;
    const newListing = { 
      id, 
      status: "active",
      ...listing,
      creditsAmount: listing.creditsAmount?.toString() ?? "0",
      pricePerCredit: listing.pricePerCredit?.toString() ?? "0",
    } as Listing;
    this.listings.set(id, newListing);
    return newListing;
  }

  async getActiveListings(): Promise<Listing[]> {
    return Array.from(this.listings.values()).filter(
      (listing) => listing.status === "active",
    );
  }

  async updateListing(id: number, updates: Partial<Listing>): Promise<Listing> {
    const listing = this.listings.get(id);
    if (!listing) throw new Error("Listing not found");
    const updatedListing = { ...listing, ...updates };
    this.listings.set(id, updatedListing);
    return updatedListing;
  }

  async getListing(id: number): Promise<Listing | undefined> {
    return this.listings.get(id);
  }
}

export const storage = new MemStorage();