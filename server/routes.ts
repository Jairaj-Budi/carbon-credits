import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertOrgSchema, insertCommuteLogSchema, insertListingSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Organizations
  app.post("/api/organizations", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }
    const orgData = insertOrgSchema.parse(req.body);
    const org = await storage.createOrganization(orgData);

    // Update the user with the new organization
    await storage.updateUser(req.user.id, {
      organizationId: org.id,
      status: "approved", // Auto-approve org admin
    });

    res.status(201).json(org);
  });

  app.get("/api/organizations/:id", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const org = await storage.getOrganization(parseInt(req.params.id));
    if (!org) return res.status(404).send("Organization not found");
    res.json(org);
  });

  app.get("/api/organizations/pending", async (req, res) => {
    if (!req.user || req.user.role !== "system_admin") {
      return res.status(403).send("Unauthorized");
    }
    const orgs = Array.from((await storage.getAllOrganizations()).values())
      .filter(org => org.status === "pending");
    res.json(orgs);
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
  app.get("/api/users/pending", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }
    const users = Array.from((await storage.getAllUsers()).values())
      .filter(user => user.status === "pending" && user.organizationId === req.user.organizationId);
    res.json(users);
  });

  app.patch("/api/users/:id/approve", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }
    const user = await storage.updateUser(parseInt(req.params.id), {
      status: "approved",
    });
    res.json(user);
  });

  app.patch("/api/users/:id/commute-distance", async (req, res) => {
    if (!req.user || req.user.id !== parseInt(req.params.id)) {
      return res.status(403).send("Unauthorized");
    }
    const user = await storage.updateUser(req.user.id, {
      commuteDistance: req.body.commuteDistance?.toString(),
    });
    res.json(user);
  });

  // Commute Logs
  app.post("/api/commute-logs", async (req, res) => {
    if (!req.user || req.user.role !== "employee") {
      return res.status(403).send("Unauthorized");
    }

    if (!req.user.commuteDistance) {
      return res.status(400).send("Please set your commute distance first");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingLog = (await storage.getUserCommuteLogs(req.user.id))
      .find(log => {
        const logDate = new Date(log.date);
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === today.getTime();
      });

    if (existingLog) {
      return res.status(400).send("You've already logged your commute for today");
    }

    const logData = insertCommuteLogSchema.parse({
      ...req.body,
      userId: req.user.id,
    });

    const userDistance = req.user.commuteDistance ? parseFloat(req.user.commuteDistance) : 0;
    const roundTripDistance = userDistance * 2;
    const pointsMultiplier = {
      drove_alone: 0,
      public_transport: 1,
      carpool: 1.5,
      work_from_home: 2,
    };
    const pointsEarned = roundTripDistance * pointsMultiplier[logData.method];

    const log = await storage.createCommuteLog({
      ...logData,
      pointsEarned: pointsEarned.toString(),
    });

    // Update organization's total credits
    if (req.user.organizationId) {
      const org = await storage.getOrganization(req.user.organizationId);
      if (org) {
        const newTotal = (parseFloat(org.totalCredits) + pointsEarned).toString();
        await storage.updateOrganization(org.id, {
          totalCredits: newTotal,
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
    if (!org || parseFloat(org.totalCredits) < listingData.creditsAmount) {
      return res.status(400).send("Insufficient credits");
    }

    const listing = await storage.createListing({
      ...listingData,
      creditsAmount: listingData.creditsAmount.toString(),
      pricePerCredit: listingData.pricePerCredit.toString(),
    });
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

    const listing = await storage.getListing(parseInt(req.params.id));
    if (!listing || listing.status !== "active") {
      return res.status(404).send("Listing not found");
    }

    const buyerOrg = await storage.getOrganization(req.user.organizationId!);
    const sellerOrg = await storage.getOrganization(listing.organizationId);

    if (!buyerOrg || !sellerOrg) {
      return res.status(400).send("Invalid organization");
    }

    const totalCost = parseFloat(listing.creditsAmount) * parseFloat(listing.pricePerCredit);
    if (parseFloat(buyerOrg.virtualBalance) < totalCost) {
      return res.status(400).send("Insufficient funds");
    }

    // Update buyer
    await storage.updateOrganization(buyerOrg.id, {
      virtualBalance: (parseFloat(buyerOrg.virtualBalance) - totalCost).toString(),
      totalCredits: (parseFloat(buyerOrg.totalCredits) + parseFloat(listing.creditsAmount)).toString(),
    });

    // Update seller
    await storage.updateOrganization(sellerOrg.id, {
      virtualBalance: (parseFloat(sellerOrg.virtualBalance) + totalCost).toString(),
      totalCredits: (parseFloat(sellerOrg.totalCredits) - parseFloat(listing.creditsAmount)).toString(),
    });

    // Mark listing as sold
    await storage.updateListing(listing.id, { status: "sold" });

    res.json({ message: "Purchase successful" });
  });

  const httpServer = createServer(app);
  return httpServer;
}