import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
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

  // Add organization rejection endpoint
  app.patch("/api/organizations/:id/reject", async (req, res) => {
    if (!req.user || req.user.role !== "system_admin") {
      return res.status(403).send("Unauthorized");
    }

    const org = await storage.updateOrganization(parseInt(req.params.id), {
      status: "rejected",
      rejectionReason: req.body.reason
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
      date: new Date(),
    });

    const userDistance = req.user.commuteDistance ? parseFloat(req.user.commuteDistance) : 0;
    const pointsEarned = calculateCommutePoints(userDistance, logData.method);

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

  // Get commute logs with analytics
  app.get("/api/commute-logs/analytics", async (req, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");

    const logs = await storage.getUserCommuteLogs(req.user.id);
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

    const org = await storage.getOrganization(parseInt(req.params.id));
    if (!org) return res.status(404).send("Organization not found");

    const users = Array.from((await storage.getAllUsers()).values())
      .filter(u => u.organizationId === org.id);

    const allLogs = await Promise.all(
      users.map(user => storage.getUserCommuteLogs(user.id))
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

    const listings = await storage.getActiveListings();
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

    const org = await storage.getOrganization(req.user.organizationId!);
    if (!org) return res.status(404).send("Organization not found");

    const users = Array.from((await storage.getAllUsers()).values())
      .filter(u => u.organizationId === org.id);

    const allLogs = await Promise.all(
      users.map(user => storage.getUserCommuteLogs(user.id))
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
    if (!req.user || req.user.role !== "org_admin") {
      return res.status(403).send("Unauthorized");
    }

    const listings = await storage.getActiveListings();

    // Filter listings for the organization
    const orgListings = listings.filter(
      listing => listing.organizationId === req.user!.organizationId
    );

    const soldListings = orgListings.filter(listing => listing.status === "sold");
    const activeListings = orgListings.filter(listing => listing.status === "active");

    // Calculate trends
    const salesTrend = soldListings.reduce((acc, listing) => {
      const month = new Date(listing.createdAt).toISOString().slice(0, 7); // YYYY-MM
      const amount = parseFloat(listing.creditsAmount);
      const value = amount * parseFloat(listing.pricePerCredit);

      acc[month] = acc[month] || { credits: 0, value: 0 };
      acc[month].credits += amount;
      acc[month].value += value;

      return acc;
    }, {} as Record<string, { credits: number; value: number }>);

    // Calculate price trends
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

    const users = Array.from((await storage.getAllUsers()).values());
    const organizations = Array.from((await storage.getAllOrganizations()).values());
    const listings = await storage.getActiveListings();

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

    // Calculate trading activity
    const soldListings = listings.filter(listing => listing.status === "sold");
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
    const allLogs = await Promise.all(
      users.map(user => storage.getUserCommuteLogs(user.id))
    );
    const flatLogs = allLogs.flat();

    // Calculate platform statistics
    const totalCommutes = flatLogs.length;
    const totalPoints = flatLogs.reduce((sum, log) => sum + parseFloat(log.pointsEarned), 0);

    res.json({
      totalOrganizations: organizations.length,
      totalUsers: users.length,
      totalCreditsTraded: soldListings.reduce((sum, l) => sum + parseFloat(l.creditsAmount), 0),
      totalTradingVolume: soldListings.reduce((sum, l) => 
        sum + (parseFloat(l.creditsAmount) * parseFloat(l.pricePerCredit)), 0),
      userGrowth,
      organizationGrowth,
      tradingActivity,
      userDistribution: {
        employees: users.filter(u => u.role === "employee").length,
        orgAdmins: users.filter(u => u.role === "org_admin").length,
        systemAdmins: users.filter(u => u.role === "system_admin").length
      },
      platformStats: {
        totalCommutes,
        avgPointsPerCommute: totalCommutes ? totalPoints / totalCommutes : 0,
        activeListings: listings.filter(l => l.status === "active").length,
        completedTrades: soldListings.length
      }
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}