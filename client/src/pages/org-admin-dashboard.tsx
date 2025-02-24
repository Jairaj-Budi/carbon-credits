import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const { data: organization } = useQuery<Organization>({
    queryKey: ["/api/organizations", user?.organizationId],
  });

  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery<OrgAnalytics>({
    queryKey: ["/api/organizations", user?.organizationId, "analytics"],
    enabled: !!user?.organizationId,
  });

  const { data: marketHistory, isLoading: isLoadingHistory } = useQuery<MarketplaceHistory>({
    queryKey: ["/api/marketplace/history"],
    enabled: !!user?.organizationId,
  });

  const { data: pendingEmployees } = useQuery<User[]>({
    queryKey: ["/api/users/pending"],
  });

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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <OrganizationRegistration user={user} />

      <div className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-lg font-semibold">Organization Admin Dashboard</h1>
          <Button variant="outline" onClick={() => logoutMutation.mutate()}>
            Logout
          </Button>
        </div>
      </div>

      <main className="container py-6">
        {/* Summary Cards */}
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

        {/* Main Content Tabs */}
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
            <Card>
              <CardHeader>
                <CardTitle>Pending Employee Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {pendingEmployees?.map((employee) => (
                      <div key={employee.id} className="flex justify-between items-center p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{employee.name}</p>
                          <p className="text-sm text-muted-foreground">{employee.username}</p>
                        </div>
                        <Button 
                          onClick={() => approveEmployeeMutation.mutate(employee.id)}
                          disabled={approveEmployeeMutation.isPending}
                        >
                          {approveEmployeeMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Approve
                        </Button>
                      </div>
                    ))}
                    {!pendingEmployees?.length && (
                      <p className="text-center text-muted-foreground">
                        No pending employees
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}