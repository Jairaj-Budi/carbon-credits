import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertOrgSchema, insertCommuteLogSchema, insertListingSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Organizations
  app.post("/api/organizations", async (req, res) => {
    const orgData = insertOrgSchema.parse(req.body);
    const org = await storage.createOrganization(orgData);
    res.status(201).json(org);
  });

  app.patch("/api/organizations/:id/approve", async (req, res) => {
    if (!req.user || req.user.role !== "system_admin") {
      return res.status(403).send("Unauthorized");
    }
    const org = await storage.updateOrganization(parseInt(req.params.id), {
      status: "approved",
    });
    res.json(org);
  });

  // Users
  app.patch("/api/users/:id/approve", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }
    const user = await storage.updateUser(parseInt(req.params.id), {
      status: "approved",
    });
    res.json(user);
  });

  // Commute Logs
  app.post("/api/commute-logs", async (req, res) => {
    if (!req.user || req.user.role !== "employee") {
      return res.status(403).send("Unauthorized");
    }
    
    const logData = insertCommuteLogSchema.parse({
      ...req.body,
      userId: req.user.id,
    });

    // Calculate points based on method and distance
    const pointsMultiplier = {
      drove_alone: 0,
      public_transport: 1,
      carpool: 1.5,
      work_from_home: 2,
    };

    const roundTripDistance = (req.user.commuteDistance || 0) * 2;
    const pointsEarned = roundTripDistance * pointsMultiplier[logData.method];

    const log = await storage.createCommuteLog({
      ...logData,
      pointsEarned,
    });

    // Update organization's total credits
    if (req.user.organizationId) {
      const org = await storage.getOrganization(req.user.organizationId);
      if (org) {
        await storage.updateOrganization(org.id, {
          totalCredits: org.totalCredits + pointsEarned,
        });
      }
    }

    res.status(201).json(log);
  });

  app.get("/api/commute-logs", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const logs = await storage.getUserCommuteLogs(req.user.id);
    res.json(logs);
  });

  // Marketplace
  app.post("/api/listings", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }
    
    const listingData = insertListingSchema.parse({
      ...req.body,
      organizationId: req.user.organizationId,
    });
    
    const org = await storage.getOrganization(req.user.organizationId!);
    if (!org || org.totalCredits < listingData.creditsAmount) {
      return res.status(400).send("Insufficient credits");
    }
    
    const listing = await storage.createListing(listingData);
    res.status(201).json(listing);
  });

  app.get("/api/listings", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const listings = await storage.getActiveListings();
    res.json(listings);
  });

  app.post("/api/purchases/:id", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }

    const listing = await storage.listings.get(parseInt(req.params.id));
    if (!listing || listing.status !== "active") {
      return res.status(404).send("Listing not found");
    }

    const buyerOrg = await storage.getOrganization(req.user.organizationId!);
    const sellerOrg = await storage.getOrganization(listing.organizationId);

    if (!buyerOrg || !sellerOrg) {
      return res.status(400).send("Invalid organization");
    }

    const totalCost = listing.creditsAmount * listing.pricePerCredit;
    if (buyerOrg.virtualBalance < totalCost) {
      return res.status(400).send("Insufficient funds");
    }

    // Update buyer
    await storage.updateOrganization(buyerOrg.id, {
      virtualBalance: buyerOrg.virtualBalance - totalCost,
      totalCredits: buyerOrg.totalCredits + listing.creditsAmount,
    });

    // Update seller
    await storage.updateOrganization(sellerOrg.id, {
      virtualBalance: sellerOrg.virtualBalance + totalCost,
      totalCredits: sellerOrg.totalCredits - listing.creditsAmount,
    });

    // Mark listing as sold
    await storage.updateListing(listing.id, { status: "sold" });

    res.json({ message: "Purchase successful" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
