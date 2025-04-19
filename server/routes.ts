import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { sqliteStorage } from "./db";
import { insertOrgSchema, insertCommuteLogSchema, insertListingSchema } from "@shared/schema";
import { calculateCommutePoints } from "@shared/utils";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Organizations
  app.post("/api/organizations", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }
    const orgData = insertOrgSchema.parse(req.body);
    const org = await sqliteStorage.createOrganization(orgData);

    // Update the user with the new organization
    await sqliteStorage.updateUser(req.user.id, {
      organizationId: org.id,
      status: "approved", // Auto-approve org admin
    });

    res.status(201).json(org);
  });

  // Public endpoint to get approved organizations for registration
  app.get("/api/organizations/public", async (_req, res) => {
    const orgs = Array.from((await sqliteStorage.getAllOrganizations()).values())
      .filter(org => org.status === "approved")
      .map(org => ({
        id: org.id,
        name: org.name
      }));
    res.json(orgs);
  });

  // Endpoint to get pending organizations for system admin
  app.get("/api/organizations/pending", async (req, res) => {
    if (!req.user || req.user.role !== "system_admin") {
      return res.status(403).send("Unauthorized");
    }
    const orgs = Array.from((await sqliteStorage.getAllOrganizations()).values())
      .filter(org => org.status === "pending");
    res.json(orgs);
  });

  app.get("/api/organizations/:id", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const org = await sqliteStorage.getOrganization(parseInt(req.params.id));
    if (!org) return res.status(404).send("Organization not found");
    res.json(org);
  });

  app.patch("/api/organizations/:id/approve", async (req, res) => {
    if (!req.user || req.user.role !== "system_admin") {
      return res.status(403).send("Unauthorized");
    }
    const org = await sqliteStorage.updateOrganization(parseInt(req.params.id), {
      status: "approved",
    });
    res.json(org);
  });

  // Add organization rejection endpoint
  app.patch("/api/organizations/:id/reject", async (req, res) => {
    if (!req.user || req.user.role !== "system_admin") {
      return res.status(403).send("Unauthorized");
    }

    const org = await sqliteStorage.updateOrganization(parseInt(req.params.id), {
      status: "rejected",
      rejectionReason: req.body.reason
    });

    res.json(org);
  });

  // Add endpoint to get all organizations for selection during signup/request
  app.get("/api/organizations/list", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const orgs = Array.from((await sqliteStorage.getAllOrganizations()).values())
      .filter(org => org.status === "approved");
    res.json(orgs);
  });

  // Get pending organization requests for an organization admin to review
  app.get("/api/organizations/:id/pending-requests", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin" || req.user.organizationId !== parseInt(req.params.id)) {
      return res.status(403).send("Unauthorized");
    }
    
    const pendingRequests = await sqliteStorage.getPendingOrganizationRequests(parseInt(req.params.id));
    res.json(pendingRequests);
  });

  // Request to join an organization (for employees)
  app.post("/api/organizations/:id/request", async (req, res) => {
    if (!req.user || req.user.role !== "employee") {
      return res.status(403).send("Unauthorized");
    }
    
    // Get the organization to verify it exists and is approved
    const org = await sqliteStorage.getOrganization(parseInt(req.params.id));
    if (!org) {
      return res.status(404).send("Organization not found");
    }
    if (org.status !== "approved") {
      return res.status(400).send("Cannot request to join a non-approved organization");
    }
    
    // Update the user with the organization request
    const updatedUser = await sqliteStorage.updateUser(req.user.id, {
      organizationRequest: parseInt(req.params.id),
      status: "pending"
    });
    
    res.status(200).json(updatedUser);
  });

  // Approve an organization join request
  app.post("/api/organizations/:orgId/requests/:userId/approve", async (req, res) => {
    const orgId = parseInt(req.params.orgId);
    const userId = parseInt(req.params.userId);
    
    if (!req.user || req.user.role !== "org_admin" || req.user.organizationId !== orgId) {
      return res.status(403).send("Unauthorized");
    }
    
    try {
      const updatedUser = await sqliteStorage.approveOrganizationRequest(userId, orgId);
      res.json(updatedUser);
    } catch (error) {
      res.status(400).send((error as Error).message);
    }
  });

  // Reject an organization join request
  app.post("/api/organizations/:orgId/requests/:userId/reject", async (req, res) => {
    const orgId = parseInt(req.params.orgId);
    const userId = parseInt(req.params.userId);
    
    if (!req.user || req.user.role !== "org_admin" || req.user.organizationId !== orgId) {
      return res.status(403).send("Unauthorized");
    }
    
    try {
      const updatedUser = await sqliteStorage.rejectOrganizationRequest(userId, orgId, req.body.reason);
      res.json(updatedUser);
    } catch (error) {
      res.status(400).send((error as Error).message);
    }
  });

  // Users
  app.get("/api/users/pending", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }
    const orgId = req.user ? req.user.organizationId : null;
    if (!orgId) {
      return res.status(400).send("Admin organization not found");
    }
    const users = Array.from((await sqliteStorage.getAllUsers()).values())
      .filter(user => user.status === "pending" && user.organizationId === orgId);
    res.json(users);
  });

  app.patch("/api/users/:id/approve", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }
    const user = await sqliteStorage.updateUser(parseInt(req.params.id), {
      status: "approved",
    });
    res.json(user);
  });

  app.patch("/api/users/:id/commute-distance", async (req, res) => {
    if (!req.user || req.user.id !== parseInt(req.params.id)) {
      return res.status(403).send("Unauthorized");
    }
    const user = await sqliteStorage.updateUser(req.user.id, {
      commuteDistance: req.body.commuteDistance?.toString(),
    });
    res.json(user);
  });

  // Commute Logs
  app.post("/api/commute-logs", async (req, res) => {
    try {
      if (!req.user || req.user.role !== "employee") {
        return res.status(403).send("Unauthorized");
      }

      // Check if user has an approved organization status
      if (!req.user.organizationId || req.user.status !== "approved") {
        return res.status(403).send("You must be approved by an organization before logging commutes");
      }

      if (!req.user.commuteDistance) {
        return res.status(400).send("Please set your commute distance first");
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingLog = (await sqliteStorage.getUserCommuteLogs(req.user.id))
        .find(log => {
          const logDate = new Date(log.date);
          logDate.setHours(0, 0, 0, 0);
          return logDate.getTime() === today.getTime();
        });

      if (existingLog) {
        return res.status(400).send("You've already logged your commute for today");
      }

      // Make sure the date is in string format before passing to the schema validator
      let formattedData = { ...req.body, userId: req.user.id };
      
      // If date is a Date object, convert it to ISO string
      if (req.body.date instanceof Date) {
        formattedData.date = req.body.date.toISOString();
      }
      
      const logData = insertCommuteLogSchema.parse(formattedData);

      const userDistance = req.user.commuteDistance ? parseFloat(req.user.commuteDistance) : 0;
      const pointsEarned = calculateCommutePoints(userDistance, logData.method);

      const log = await sqliteStorage.createCommuteLog({
        ...logData,
        pointsEarned: pointsEarned.toString(),
      });

      // Update organization's total credits
      if (req.user.organizationId) {
        const org = await sqliteStorage.getOrganization(req.user.organizationId);
        if (org) {
          const pointsNumber = parseFloat(pointsEarned.toString());
          const currentCredits = parseFloat(org.totalCredits);
          const newTotal = (currentCredits + pointsNumber).toString();
          console.log(`[Commute Log] User ${req.user.id} earned ${pointsNumber} points. Updating Org ${org.id} credits from ${currentCredits} to ${newTotal}`);
          try {
            await sqliteStorage.updateOrganization(org.id, {
              totalCredits: newTotal,
            });
            console.log(`[Commute Log] Successfully called updateOrganization for Org ${org.id}`);
            // Optionally, re-fetch org to confirm update immediately
            // const updatedOrg = await sqliteStorage.getOrganization(org.id);
            // console.log(`[Commute Log] Org ${org.id} credits after update attempt: ${updatedOrg?.totalCredits}`);
          } catch (updateError) {
            console.error(`[Commute Log] Error calling updateOrganization for Org ${org.id}:`, updateError);
          }
        } else {
           console.log(`[Commute Log] Org not found for ID: ${req.user.organizationId}`);
        }
      }

      res.status(201).json(log);
    } catch (error: unknown) {
      console.error("Error logging commute:", error);
      if (error instanceof Error && error.name === "ZodError") {
        const zodError = error as any; // Type assertion for ZodError
        return res.status(400).json({ 
          message: "Invalid data format", 
          errors: zodError.errors || zodError.message 
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/commute-logs", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const logs = await sqliteStorage.getUserCommuteLogs(req.user.id);
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

    const org = await sqliteStorage.getOrganization(req.user.organizationId!);
    if (!org || parseFloat(org.totalCredits) < listingData.creditsAmount) {
      return res.status(400).send("Insufficient credits");
    }

    const listing = await sqliteStorage.createListing({
      ...listingData,
      creditsAmount: listingData.creditsAmount.toString(),
      pricePerCredit: listingData.pricePerCredit.toString(),
    });
    res.status(201).json(listing);
  });

  app.get("/api/listings", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const listings = await sqliteStorage.getActiveListings();
    res.json(listings);
  });

  app.post("/api/purchases/:id", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }

    const listing = await sqliteStorage.getListing(parseInt(req.params.id));
    if (!listing || listing.status !== "active") {
      return res.status(404).send("Listing not found");
    }

    const buyerOrg = await sqliteStorage.getOrganization(req.user.organizationId!);
    const sellerOrg = await sqliteStorage.getOrganization(listing.organizationId);

    if (!buyerOrg || !sellerOrg) {
      return res.status(400).send("Invalid organization");
    }

    const totalCost = parseFloat(listing.creditsAmount) * parseFloat(listing.pricePerCredit);
    if (parseFloat(buyerOrg.virtualBalance) < totalCost) {
      return res.status(400).send("Insufficient funds");
    }

    // Update buyer
    await sqliteStorage.updateOrganization(buyerOrg.id, {
      virtualBalance: (parseFloat(buyerOrg.virtualBalance) - totalCost).toString(),
      totalCredits: (parseFloat(buyerOrg.totalCredits) + parseFloat(listing.creditsAmount)).toString(),
    });

    // Update seller
    await sqliteStorage.updateOrganization(sellerOrg.id, {
      virtualBalance: (parseFloat(sellerOrg.virtualBalance) + totalCost).toString(),
      totalCredits: (parseFloat(sellerOrg.totalCredits) - parseFloat(listing.creditsAmount)).toString(),
    });

    // Mark listing as sold
    await sqliteStorage.updateListing(listing.id, { status: "sold" });

    res.json({ message: "Purchase successful" });
  });

  // Get commute logs with analytics
  app.get("/api/commute-logs/analytics", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");

    const logs = await sqliteStorage.getUserCommuteLogs(req.user.id);
    const analytics = {
      totalPoints: logs.reduce((sum, log) => sum + parseFloat(log.pointsEarned), 0),
      methodBreakdown: logs.reduce((acc, log) => {
        acc[log.method] = (acc[log.method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      dailyAverage: logs.length ? (logs.reduce((sum, log) => sum + parseFloat(log.pointsEarned), 0) / logs.length) : 0
    };

    res.json({
      logs,
      analytics
    });
  });

  // Get organization analytics
  app.get("/api/organizations/:id/analytics", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");

    const org = await sqliteStorage.getOrganization(parseInt(req.params.id));
    if (!org) return res.status(404).send("Organization not found");

    const users = Array.from((await sqliteStorage.getAllUsers()).values())
      .filter(u => u.organizationId === org.id);

    const allLogs = await Promise.all(
      users.map(user => sqliteStorage.getUserCommuteLogs(user.id))
    );

    const flatLogs = allLogs.flat();
    const totalPoints = flatLogs.reduce((sum, log) => sum + parseFloat(log.pointsEarned), 0);
    const employeeStats = users.map(user => {
      const userLogs = flatLogs.filter(log => log.userId === user.id);
      return {
        userId: user.id,
        name: user.name,
        totalPoints: userLogs.reduce((sum, log) => sum + parseFloat(log.pointsEarned), 0),
        logCount: userLogs.length
      };
    });

    res.json({
      organizationName: org.name,
      totalPoints,
      totalCredits: parseFloat(org.totalCredits),
      virtualBalance: parseFloat(org.virtualBalance),
      employeeCount: users.length,
      employeeStats
    });
  });

  // Get marketplace history
  app.get("/api/marketplace/history", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(403).send("Unauthorized");
    }

    const listings = await sqliteStorage.getActiveListings();
    const orgListings = listings.filter(
      listing => listing.organizationId === req.user!.organizationId
    );

    const soldListings = orgListings.filter(listing => listing.status === "sold");
    const activeListings = orgListings.filter(listing => listing.status === "active");

    res.json({
      sold: soldListings,
      active: activeListings,
      totalSoldCredits: soldListings.reduce((sum, listing) => sum + parseFloat(listing.creditsAmount), 0),
      totalSoldValue: soldListings.reduce(
        (sum, listing) => sum + (parseFloat(listing.creditsAmount) * parseFloat(listing.pricePerCredit)), 
        0
      )
    });
  });

  // Add analytics endpoints
  app.get("/api/analytics/organization-summary", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }

    const org = await sqliteStorage.getOrganization(req.user.organizationId!);
    if (!org) return res.status(404).send("Organization not found");

    const users = Array.from((await sqliteStorage.getAllUsers()).values())
      .filter(u => u.organizationId === org.id);

    const allLogs = await Promise.all(
      users.map(user => sqliteStorage.getUserCommuteLogs(user.id))
    );

    const flatLogs = allLogs.flat();

    // Method distribution
    const methodDistribution = flatLogs.reduce((acc, log) => {
      acc[log.method] = (acc[log.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Daily points trend (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    const dailyTrend = flatLogs
      .filter(log => new Date(log.date) >= thirtyDaysAgo)
      .reduce((acc, log) => {
        const date = new Date(log.date).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + parseFloat(log.pointsEarned);
        return acc;
      }, {} as Record<string, number>);

    // Employee performance ranking
    const employeePerformance = users.map(user => {
      const userLogs = flatLogs.filter(log => log.userId === user.id);
      return {
        userId: user.id,
        name: user.name,
        totalPoints: userLogs.reduce((sum, log) => sum + parseFloat(log.pointsEarned), 0),
        commutesLogged: userLogs.length,
        averagePoints: userLogs.length ? 
          userLogs.reduce((sum, log) => sum + parseFloat(log.pointsEarned), 0) / userLogs.length : 0
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    res.json({
      methodDistribution,
      dailyTrend,
      employeePerformance,
      summary: {
        totalEmployees: users.length,
        totalPoints: flatLogs.reduce((sum, log) => sum + parseFloat(log.pointsEarned), 0),
        averagePointsPerEmployee: employeePerformance.reduce((sum, emp) => sum + emp.averagePoints, 0) / users.length,
        totalCommutes: flatLogs.length
      }
    });
  });

  // Add marketplace analytics endpoint
  app.get("/api/analytics/marketplace", async (req, res) => {
    if (!req.user || req.user.role !== "org_admin" || !req.user.organizationId) {
      return res.status(403).send("Unauthorized or missing organization ID");
    }
    
    const orgId = req.user.organizationId;

    // Get ACTIVE listings CREATED BY this organization
    const allActiveListings = await sqliteStorage.getActiveListings();
    const activeListings = allActiveListings.filter(
      listing => listing.organizationId === orgId
    );

    // Get SOLD listings CREATED BY this organization using the new method
    const soldListings = await sqliteStorage.getSoldListingsByOrg(orgId);
    
    // Calculate trends based on actual sold listings
    const salesTrend = soldListings.reduce((acc, listing) => {
      // Ensure createdAt is valid before processing
      if (!listing.createdAt) return acc;
      try {
        const month = new Date(listing.createdAt).toISOString().slice(0, 7); // YYYY-MM
        const amount = parseFloat(listing.creditsAmount);
        const value = amount * parseFloat(listing.pricePerCredit);

        acc[month] = acc[month] || { credits: 0, value: 0 };
        acc[month].credits += amount;
        acc[month].value += value;
      } catch (e) {
        console.error(`[Analytics/Marketplace] Error processing date for listing ${listing.id}:`, listing.createdAt, e);
      }
      return acc;
    }, {} as Record<string, { credits: number; value: number }>);

    // Calculate price trends based on actual sold listings
    const priceAnalysis = soldListings.reduce((acc, listing) => {
      const price = parseFloat(listing.pricePerCredit);
      if (!acc.min || price < acc.min) acc.min = price;
      if (!acc.max || price > acc.max) acc.max = price;
      acc.total += price;
      acc.count++;
      return acc;
    }, { min: 0, max: 0, total: 0, count: 0 });

    res.json({
      currentListings: {
        active: activeListings.length,
        totalCredits: activeListings.reduce((sum, l) => sum + parseFloat(l.creditsAmount), 0),
        averagePrice: activeListings.length ? 
          activeListings.reduce((sum, l) => sum + parseFloat(l.pricePerCredit), 0) / activeListings.length : 0
      },
      salesHistory: {
        totalSales: soldListings.length,
        totalCredits: soldListings.reduce((sum, l) => sum + parseFloat(l.creditsAmount), 0),
        totalValue: soldListings.reduce((sum, l) => 
          sum + (parseFloat(l.creditsAmount) * parseFloat(l.pricePerCredit)), 0),
        averagePrice: priceAnalysis.count ? priceAnalysis.total / priceAnalysis.count : 0,
        minPrice: priceAnalysis.min,
        maxPrice: priceAnalysis.max
      },
      trends: {
        sales: salesTrend
      }
    });
  });

  // Add at the end of the file, before the httpServer creation
  app.get("/api/analytics/system", async (req, res) => {
    if (!req.user || req.user.role !== "system_admin") {
      return res.status(403).send("Unauthorized");
    }

    const users = Array.from((await sqliteStorage.getAllUsers()).values());
    const organizations = Array.from((await sqliteStorage.getAllOrganizations()).values());
    // Fetch ALL listings initially is not efficient if only need active/sold
    // const listings = await sqliteStorage.getActiveListings(); 
    
    // Fetch active and sold listings separately
    const activeListings = await sqliteStorage.getActiveListings();
    const soldListings = await sqliteStorage.getAllSoldListings(); // Use the correct method

    // Helper function to safely get month string
    const getMonthString = (date: Date | string | null | undefined): string => {
      if (!date) return 'unknown';
      try {
        return new Date(date).toISOString().slice(0, 7);
      } catch (e) {
        return 'unknown';
      }
    };

    // Calculate user growth (last 6 months)
    const userGrowth = users.reduce((acc, user) => {
      const month = getMonthString(user.createdAt);
      if (month !== 'unknown') {
        acc[month] = (acc[month] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Calculate organization growth
    const organizationGrowth = organizations.reduce((acc, org) => {
      const month = getMonthString(org.createdAt);
      if (month !== 'unknown') {
        acc[month] = (acc[month] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Calculate trading activity based on actual sold listings
    // const soldListings = listings.filter(listing => listing.status === "sold"); // Remove old filter
    const tradingActivity = soldListings.reduce((acc, listing) => {
      const month = getMonthString(listing.createdAt);
      if (month !== 'unknown') {
        const credits = parseFloat(listing.creditsAmount);
        const volume = credits * parseFloat(listing.pricePerCredit);

        acc[month] = acc[month] || { credits: 0, volume: 0 };
        acc[month].credits += credits;
        acc[month].volume += volume;
      }
      return acc;
    }, {} as Record<string, { credits: number; volume: number }>);

    // Get all commute logs
    // ... (commute log fetching remains the same) ...
    const allLogs = await Promise.all(
      users.map(user => sqliteStorage.getUserCommuteLogs(user.id))
    );
    const flatLogs = allLogs.flat();

    // Calculate platform statistics
    const totalCommutes = flatLogs.length;
    const totalPoints = flatLogs.reduce((sum, log) => sum + parseFloat(log.pointsEarned), 0);

    res.json({
      totalOrganizations: organizations.length,
      totalUsers: users.length,
      // Use the correct soldListings array for these stats
      totalCreditsTraded: soldListings.reduce((sum, l) => sum + parseFloat(l.creditsAmount), 0),
      totalTradingVolume: soldListings.reduce((sum, l) => 
        sum + (parseFloat(l.creditsAmount) * parseFloat(l.pricePerCredit)), 0),
      userGrowth,
      organizationGrowth,
      tradingActivity,
      // ... (userDistribution remains the same) ...
      userDistribution: {
        employees: users.filter(u => u.role === "employee").length,
        orgAdmins: users.filter(u => u.role === "org_admin").length,
        systemAdmins: users.filter(u => u.role === "system_admin").length
      },
      platformStats: {
        totalCommutes,
        avgPointsPerCommute: totalCommutes ? totalPoints / totalCommutes : 0,
        // Use the correct activeListings array here
        activeListings: activeListings.length, 
        // Use the correct soldListings array here
        completedTrades: soldListings.length 
      }
    });
  });

  // TEMPORARY DEV ENDPOINT: Approve all organizations
  app.get("/api/dev/approve-all-orgs", async (_req, res) => {
    const organizations = await sqliteStorage.getAllOrganizations();
    const orgArray = Array.from(organizations.entries());
    
    for (const [id, org] of orgArray) {
      if (org.status === "pending") {
        await sqliteStorage.updateOrganization(id, { status: "approved" });
      }
    }
    
    res.json({ message: "All pending organizations have been approved." });
  });

  // TEMPORARY DEV ENDPOINT: Create a test pending organization
  app.get("/api/dev/create-test-org", async (_req, res) => {
    const testOrg = await sqliteStorage.createOrganization({
      name: "Test Pending Organization " + new Date().toISOString().slice(0, 16),
      description: "This is a test organization created for development purposes",
      address: "123 Test Street, Test City",
      status: "pending"
    });
    
    res.json({ 
      message: "Test organization created with pending status", 
      organization: testOrg 
    });
  });

  // TEMPORARY DEV ENDPOINT: Check pending organization requests
  app.get("/api/dev/check-pending-requests", async (_req, res) => {
    const organizations = await sqliteStorage.getAllOrganizations();
    const users = await sqliteStorage.getAllUsers();
    
    const userArray = Array.from(users.values());
    const orgArray = Array.from(organizations.entries());
    
    const pendingRequests = [];
    
    for (const user of userArray) {
      if (user.status === "pending" && user.organizationRequest) {
        const org = organizations.get(user.organizationRequest);
        pendingRequests.push({
          userId: user.id,
          userName: user.name,
          userStatus: user.status,
          organizationRequest: user.organizationRequest,
          organizationName: org ? org.name : "Unknown Organization"
        });
      }
    }
    
    res.json({
      pendingRequestsCount: pendingRequests.length,
      pendingRequests: pendingRequests,
      userCount: userArray.length,
      organizationCount: orgArray.length
    });
  });

  // TEMPORARY DEV ENDPOINT: Backfill createdAt for existing users/orgs
  app.get("/api/dev/backfill-createdat", async (req, res) => {
    if (!req.user || req.user.role !== "system_admin") {
      return res.status(403).send("Unauthorized");
    }

    let usersUpdated = 0;
    let orgsUpdated = 0;
    const now = new Date().toISOString();

    try {
      console.log("[DEV] Starting createdAt backfill...");
      const usersMap = await sqliteStorage.getAllUsers();
      const organizationsMap = await sqliteStorage.getAllOrganizations();

      // Update users - Use forEach
      console.log(`[DEV] Checking ${usersMap.size} users...`);
      await Promise.all(Array.from(usersMap.entries()).map(async ([id, user]) => {
        if (!user.createdAt) {
          console.log(`[DEV] Updating createdAt for user ID: ${id}`);
          await sqliteStorage.updateUser(id, { createdAt: now });
          usersUpdated++;
        }
      }));

      // Update organizations - Use forEach
      console.log(`[DEV] Checking ${organizationsMap.size} organizations...`);
      await Promise.all(Array.from(organizationsMap.entries()).map(async ([id, org]) => {
        if (!org.createdAt) {
          console.log(`[DEV] Updating createdAt for organization ID: ${id}`);
          await sqliteStorage.updateOrganization(id, { createdAt: now });
          orgsUpdated++;
        }
      }));
      
      console.log("[DEV] Backfill complete.");
      res.json({ 
        message: "Backfill complete.", 
        usersUpdated, 
        orgsUpdated 
      });

    } catch (error) {
      console.error("[DEV] Error during createdAt backfill:", error);
      res.status(500).json({ message: "Error during backfill", error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}