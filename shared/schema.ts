import { pgTable, text, serial, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["system_admin", "org_admin", "employee"] }).notNull(),
  organizationId: integer("organization_id"),
  commuteDistance: decimal("commute_distance", { precision: 10, scale: 2 }),
  status: text("status", { enum: ["pending", "approved"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  virtualBalance: decimal("virtual_balance", { precision: 10, scale: 2 }).notNull().default("1000"),
  totalCredits: decimal("total_credits", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const commuteLogs = pgTable("commute_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: timestamp("date").notNull(),
  method: text("method", { enum: ["drove_alone", "public_transport", "carpool", "work_from_home"] }).notNull(),
  pointsEarned: decimal("points_earned", { precision: 10, scale: 2 }).notNull(),
});

export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  creditsAmount: decimal("credits_amount", { precision: 10, scale: 2 }).notNull(),
  pricePerCredit: decimal("price_per_credit", { precision: 10, scale: 2 }).notNull(),
  status: text("status", { enum: ["active", "sold"] }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true })
  .extend({
    password: z.string().min(6),
    commuteDistance: z.number().optional(),
  });

export const insertOrgSchema = createInsertSchema(organizations)
  .omit({ id: true, virtualBalance: true, totalCredits: true, createdAt: true })
  .extend({
    description: z.string().optional(),
  });

export const insertCommuteLogSchema = createInsertSchema(commuteLogs)
  .omit({ id: true, pointsEarned: true });

export const insertListingSchema = createInsertSchema(listings)
  .omit({ id: true, status: true, createdAt: true })
  .extend({
    creditsAmount: z.number().positive(),
    pricePerCredit: z.number().positive(),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type CommuteLog = typeof commuteLogs.$inferSelect;
export type Listing = typeof listings.$inferSelect;