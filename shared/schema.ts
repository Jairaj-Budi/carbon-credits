import { z } from "zod";

export interface User {
  id: number;
  username: string;
  password: string;
  name: string;
  role: "system_admin" | "org_admin" | "employee";
  organizationId?: number | null;
  commuteDistance?: string | null;
  status: "pending" | "approved" | "rejected";
  organizationRequest?: number | null;
  rejectionReason?: string | null;
  createdAt: string;
}

export interface Organization {
  id: number;
  name: string;
  description?: string | null;
  address: string;
  virtualBalance: string;
  totalCredits: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  createdAt: string;
}

export interface CommuteLog {
  id: number;
  userId: number;
  date: string;
  method: "drove_alone" | "public_transport" | "carpool" | "work_from_home";
  pointsEarned: string;
}

export interface Listing {
  id: number;
  organizationId: number;
  creditsAmount: string;
  pricePerCredit: string;
  status: "active" | "sold";
  createdAt: string;
}

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string().min(6),
  name: z.string(),
  role: z.enum(["system_admin", "org_admin", "employee"]),
  organizationId: z.number().optional(),
  organizationRequest: z.number().optional(),
  commuteDistance: z.number().optional(),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

export const insertOrgSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  address: z.string(),
});

export const insertCommuteLogSchema = z.object({
  userId: z.number(),
  date: z.string(),
  method: z.enum(["drove_alone", "public_transport", "carpool", "work_from_home"]),
});

export const insertListingSchema = z.object({
  organizationId: z.number(),
  creditsAmount: z.number().positive(),
  pricePerCredit: z.number().positive(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;