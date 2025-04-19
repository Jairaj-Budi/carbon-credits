import { User, Organization, CommuteLog, Listing, InsertUser } from "@shared/schema";
import session from "express-session";

export interface IStorage {
  sessionStore: session.Store;

  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<Map<number, User>>;

  // Organization methods
  getOrganization(id: number): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Map<number, Organization>>;
  createOrganization(org: Partial<Organization>): Promise<Organization>;
  updateOrganization(id: number, updates: Partial<Organization>): Promise<Organization>;
  
  // Organization membership methods
  getPendingOrganizationRequests(organizationId: number): Promise<User[]>;
  approveOrganizationRequest(userId: number, organizationId: number): Promise<User>;
  rejectOrganizationRequest(userId: number, organizationId: number, reason?: string): Promise<User>;

  // Commute log methods
  createCommuteLog(log: Partial<CommuteLog>): Promise<CommuteLog>;
  getUserCommuteLogs(userId: number): Promise<CommuteLog[]>;

  // Listing methods
  createListing(listing: Partial<Listing>): Promise<Listing>;
  getActiveListings(): Promise<Listing[]>;
  getListing(id: number): Promise<Listing | undefined>;
  updateListing(id: number, updates: Partial<Listing>): Promise<Listing>;
}