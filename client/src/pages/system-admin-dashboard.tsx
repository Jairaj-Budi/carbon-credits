import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Organization } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function SystemAdminDashboard() {
  const { logoutMutation } = useAuth();
  const { toast } = useToast();

  const { data: pendingOrganizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations/pending"],
  });

  const approveOrgMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const res = await apiRequest("PATCH", `/api/organizations/${orgId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/pending"] });
      toast({
        title: "Success",
        description: "Organization approved successfully",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-lg font-semibold">System Admin Dashboard</h1>
          <Button variant="outline" onClick={() => logoutMutation.mutate()}>
            Logout
          </Button>
        </div>
      </div>

      <main className="container py-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Organization Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {pendingOrganizations?.map((org) => (
                  <div key={org.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-sm text-muted-foreground">{org.address}</p>
                    </div>
                    <Button 
                      onClick={() => approveOrgMutation.mutate(org.id)}
                      disabled={approveOrgMutation.isPending}
                    >
                      {approveOrgMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Approve
                    </Button>
                  </div>
                ))}
                {!pendingOrganizations?.length && (
                  <p className="text-center text-muted-foreground">
                    No pending organizations
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}