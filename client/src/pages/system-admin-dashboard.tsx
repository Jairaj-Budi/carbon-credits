import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Organization } from "@shared/schema";

export default function SystemAdminDashboard() {
  const { logoutMutation } = useAuth();
  const { data: pendingOrganizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations", "pending"],
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
                      onClick={() => {
                        // Implement approval mutation
                      }}
                    >
                      Approve
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
