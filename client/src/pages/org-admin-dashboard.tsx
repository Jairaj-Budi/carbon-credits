import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Marketplace } from "@/components/marketplace";
import { OrganizationRegistration } from "@/components/organization-registration";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { Organization, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

type OrgAnalytics = {
  organizationName: string;
  totalPoints: number;
  totalCredits: number;
  virtualBalance: number;
  employeeCount: number;
  employeeStats: {
    userId: number;
    name: string;
    totalPoints: number;
    logCount: number;
  }[];
};

type MarketplaceHistory = {
  sold: any[];
  active: any[];
  totalSoldCredits: number;
  totalSoldValue: number;
};

export default function OrgAdminDashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    console.log("[OrgAdminDashboard] User object:", user);
  }, [user]);

  const { data: organization } = useQuery<Organization>({
    queryKey: ["/api/organizations", user?.organizationId],
    enabled: !!user?.organizationId,
  });

  const { data: analytics, isLoading: isLoadingAnalytics, isError: isErrorAnalytics, error: errorAnalytics } = useQuery<OrgAnalytics>({
    queryKey: ["/api/organizations", user?.organizationId, "analytics"],
    enabled: !!user?.organizationId,
  });

  useEffect(() => {
    console.log("[OrgAdminDashboard] Analytics Query:", { 
      isLoading: isLoadingAnalytics, 
      isError: isErrorAnalytics, 
      error: errorAnalytics, 
      data: analytics 
    });
    console.log("[OrgAdminDashboard] Analytics Employee Stats:", analytics?.employeeStats);
  }, [analytics, isLoadingAnalytics, isErrorAnalytics, errorAnalytics]);

  const { data: marketHistory, isLoading: isLoadingHistory } = useQuery<MarketplaceHistory>({
    queryKey: ["/api/marketplace/history"],
    enabled: !!user?.organizationId,
  });

  const { data: pendingRequests, isLoading: isLoadingPending, isError: isErrorPending, error: errorPending } = useQuery<User[]>({
    queryKey: ["/api/organizations", user?.organizationId, "pending-requests"],
    enabled: !!user?.organizationId,
  });

  useEffect(() => {
    console.log("[OrgAdminDashboard] Pending Requests Query:", { 
      isLoading: isLoadingPending, 
      isError: isErrorPending, 
      error: errorPending, 
      data: pendingRequests 
    });
  }, [pendingRequests, isLoadingPending, isErrorPending, errorPending]);

  const approveEmployeeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/pending"] });
      toast({
        title: "Success",
        description: "Employee approved successfully",
      });
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest(
        "POST", 
        `/api/organizations/${user?.organizationId}/requests/${userId}/approve`
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/organizations", user?.organizationId, "pending-requests"] 
      });
      toast({
        title: "Success",
        description: "Employee request approved successfully",
      });
    },
    onError: (error: Error) => {
      console.error("[OrgAdminDashboard] Approve Request Error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason?: string }) => {
      const res = await apiRequest(
        "POST", 
        `/api/organizations/${user?.organizationId}/requests/${userId}/reject`,
        { reason }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/organizations", user?.organizationId, "pending-requests"] 
      });
      toast({
        title: "Success",
        description: "Employee request rejected",
      });
    },
    onError: (error: Error) => {
      console.error("[OrgAdminDashboard] Reject Request Error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (!user) {
    console.log("[OrgAdminDashboard] User not loaded yet, returning null.");
    return null;
  }

  if (!user.organizationId && user.role === 'org_admin') {
    console.log("[OrgAdminDashboard] Org Admin user loaded, but no organizationId found. Showing Org Registration.");
  }

  return (
    <div className="min-h-screen bg-background">
      {user.role === 'org_admin' && !user.organizationId && <OrganizationRegistration user={user} />}

      <div className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-lg font-semibold">Organization Admin Dashboard</h1>
          <Button variant="outline" onClick={() => logoutMutation.mutate()}>
            Logout
          </Button>
        </div>
      </div>

      {user.organizationId ? (
        <main className="container py-6">
          <div className="grid gap-6 mb-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(analytics?.totalCredits ?? 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Virtual Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics?.virtualBalance ?? 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sold Credits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(marketHistory?.totalSoldCredits ?? 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(marketHistory?.totalSoldValue ?? 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
              <TabsTrigger value="employees">Employees</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <AnalyticsDashboard />
            </TabsContent>

            <TabsContent value="marketplace" className="space-y-4">
              <Marketplace organization={organization} />
            </TabsContent>

            <TabsContent value="employees">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Membership Requests</CardTitle>
                    <CardDescription>
                      Employees waiting for approval to join your organization
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-4">
                        {isLoadingPending ? (
                          <p className="text-center text-muted-foreground">Loading pending requests...</p>
                        ) : isErrorPending ? (
                           <p className="text-center text-red-500">Error loading requests: {errorPending?.message}</p>
                        ) : pendingRequests && pendingRequests.length > 0 ? (
                          pendingRequests.map((employee) => (
                            <div key={employee.id} className="flex justify-between items-center p-4 border rounded-lg">
                              <div>
                                <p className="font-medium">{employee.name}</p>
                                <p className="text-sm text-muted-foreground">{employee.username}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  onClick={() => rejectRequestMutation.mutate({ userId: employee.id })}
                                  disabled={rejectRequestMutation.isPending}
                                >
                                  {rejectRequestMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Reject
                                </Button>
                                <Button 
                                  onClick={() => approveRequestMutation.mutate(employee.id)}
                                  disabled={approveRequestMutation.isPending}
                                >
                                  {approveRequestMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Approve
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-muted-foreground">
                            No pending membership requests
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Approved Employees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                         {isLoadingAnalytics ? (
                          <p className="text-center text-muted-foreground">Loading employees...</p>
                        ) : isErrorAnalytics ? (
                          <p className="text-center text-red-500">Error loading employees: {errorAnalytics?.message}</p>
                        ) : analytics?.employeeStats && analytics.employeeStats.length > 0 ? (
                          analytics.employeeStats.map((employee) => (
                            <div key={employee.userId} className="flex justify-between items-center p-4 border rounded-lg">
                              <div>
                                <p className="font-medium">{employee.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {employee.logCount} commutes • {formatNumber(employee.totalPoints)} points
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-muted-foreground">
                            No approved employees yet
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      ) : (
         user.role === 'org_admin' && (
             <div className="container py-6 text-center text-muted-foreground">
                Complete organization registration to view dashboard.
             </div>
         )
      )}
    </div>
  );
}