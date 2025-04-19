import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CommuteLogForm } from "@/components/commute-log-form";
import { CommuteDistanceModal } from "@/components/commute-distance-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNumber } from "@/lib/utils";
import { transportationMethods } from "@/lib/utils";
import { CommuteLog, Organization } from "@shared/schema";
import { format } from "date-fns";
import { Loader2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CommuteAnalytics = {
  logs: CommuteLog[];
  analytics: {
    totalPoints: number;
    methodBreakdown: Record<string, number>;
    dailyAverage: number;
  };
};

export default function EmployeeDashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null);
  const { data: commuteData, isLoading } = useQuery<CommuteAnalytics>({ 
    queryKey: ["/api/commute-logs/analytics"],
    // Only fetch if user is approved
    enabled: !!user?.organizationId && user?.status === "approved"
  });

  const { data: organization } = useQuery<Organization>({
    queryKey: ["/api/organizations", user?.organizationId],
    enabled: !!user?.organizationId
  });

  const { data: requestedOrganization } = useQuery<Organization>({
    queryKey: ["/api/organizations", user?.organizationRequest],
    enabled: !!user?.organizationRequest && user?.status === "pending"
  });

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations/public"],
    enabled: !user?.organizationId || user?.status === "rejected",
  });

  const joinOrgMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const res = await apiRequest("POST", `/api/organizations/${orgId}/request`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Request Submitted",
        description: "Your request to join the organization has been submitted. Please wait for approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (!user) return null;

  // Function to handle join request submission
  const handleJoinRequest = () => {
    if (!selectedOrg) {
      toast({
        title: "Error",
        description: "Please select an organization",
        variant: "destructive"
      });
      return;
    }
    
    joinOrgMutation.mutate(selectedOrg);
  };

  // Render different views based on user status
  const renderStatusView = () => {
    if (user.status === "pending" && user.organizationRequest) {
      return (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Pending Approval
            </CardTitle>
            <CardDescription>
              Your request to join {requestedOrganization?.name || "the organization"} is pending approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Once an organization admin approves your request, you'll be able to log your commutes and start earning credits.
            </p>
          </CardContent>
        </Card>
      );
    } else if (user.status === "rejected") {
      return (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Request Rejected
            </CardTitle>
            <CardDescription>
              Your organization request was declined.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              {user.rejectionReason ? `Reason: ${user.rejectionReason}` : 'No reason was provided.'}
            </p>
            
            <div className="space-y-4">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Select another organization
                </label>
                <select 
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={selectedOrg || ""}
                  onChange={(e) => setSelectedOrg(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Select an organization</option>
                  {organizations?.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <Button 
                onClick={handleJoinRequest}
                disabled={joinOrgMutation.isPending || !selectedOrg}
              >
                {joinOrgMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Request to Join
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    } else if (!user.organizationId && !user.organizationRequest) {
      return (
        <Card className="border-blue-500">
          <CardHeader>
            <CardTitle>Join an Organization</CardTitle>
            <CardDescription>
              You need to join an organization before you can start logging commutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Please select an organization to request membership.
            </p>
            
            <div className="space-y-4">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Select an organization
                </label>
                <select 
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={selectedOrg || ""}
                  onChange={(e) => setSelectedOrg(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Select an organization</option>
                  {organizations?.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <Button 
                onClick={handleJoinRequest}
                disabled={joinOrgMutation.isPending || !selectedOrg}
              >
                {joinOrgMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Request to Join
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    } else if (user.status === "approved" && user.organizationId) {
      return (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Approved Member
            </CardTitle>
            <CardDescription>
              You're an approved member of {organization?.name || "your organization"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You can now log your commutes and earn carbon credits for your organization.
            </p>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <CommuteDistanceModal user={user} />

      <div className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-lg font-semibold">Employee Dashboard</h1>
          <Button variant="outline" onClick={() => logoutMutation.mutate()}>
            Logout
          </Button>
        </div>
      </div>

      <main className="container py-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          {/* Status view */}
          {renderStatusView()}
          
          {/* Only show stats and commute form if approved */}
          {user.status === "approved" && user.organizationId && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>My Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Total Points</dt>
                        <dd className="text-2xl font-bold">
                          {formatNumber(commuteData?.analytics.totalPoints ?? 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Daily Average</dt>
                        <dd className="text-2xl font-bold">
                          {formatNumber(commuteData?.analytics.dailyAverage ?? 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Commute Distance</dt>
                        <dd className="text-2xl font-bold">
                          {formatNumber(user?.commuteDistance ? parseFloat(user.commuteDistance) : 0)} mi
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Total Commutes</dt>
                        <dd className="text-2xl font-bold">
                          {commuteData?.logs.length ?? 0}
                        </dd>
                      </div>
                    </dl>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Log Commute</CardTitle>
                </CardHeader>
                <CardContent>
                  <CommuteLogForm />
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Only show commute logs if approved */}
        {user.status === "approved" && user.organizationId ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent Commute Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {commuteData?.logs.map((log) => {
                      const method = transportationMethods.find(m => m.value === log.method);
                      return (
                        <div key={log.id} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{method?.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(log.date), "PPP")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatNumber(parseFloat(log.pointsEarned))} pts</p>
                          </div>
                        </div>
                      );
                    })}
                    {!commuteData?.logs.length && (
                      <p className="text-center text-muted-foreground">
                        No commute logs yet
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-medium mb-2">How it works</h3>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>Request to join an organization</li>
                    <li>Wait for approval from the organization admin</li>
                    <li>Set your commute distance</li>
                    <li>Log your daily commutes</li>
                    <li>Earn carbon credits for your organization</li>
                  </ol>
                </div>
                <p className="text-muted-foreground">
                  By using sustainable transportation methods, you help reduce carbon emissions and earn credits for your organization.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}