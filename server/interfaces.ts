import { User, Organization, CommuteLog, Listing, InsertUser } from "@shared/schema";
import session from "express-session";

export interface IStorage {
  sessionStore: session.Store;

  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;

  // Organization methods
  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: Partial<Organization>): Promise<Organization>;
  updateOrganization(id: number, updates: Partial<Organization>): Promise<Organization>;

  // Commute log methods
  createCommuteLog(log: Partial<CommuteLog>): Promise<CommuteLog>;
  getUserCommuteLogs(userId: number): Promise<CommuteLog[]>;

  // Listing methods
  createListing(listing: Partial<Listing>): Promise<Listing>;
  getActiveListings(): Promise<Listing[]>;
  updateListing(id: number, updates: Partial<Listing>): Promise<Listing>;
}
