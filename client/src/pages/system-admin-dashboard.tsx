import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Organization } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SystemAnalyticsDashboard } from "@/components/system-analytics-dashboard";
import { useState } from "react";

export default function SystemAdminDashboard() {
  const { logoutMutation } = useAuth();
  const { toast } = useToast();
  const [rejectReason, setRejectReason] = useState("");

  const { data: pendingOrganizations, isLoading: isLoadingOrgs } = useQuery<Organization[]>({
    queryKey: ["/api/organizations/pending"],
  });

  const approveOrgMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const res = await apiRequest("PATCH", `/api/organizations/${orgId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/system"] });
      toast({
        title: "Success",
        description: "Organization approved successfully",
      });
    },
  });

  const rejectOrgMutation = useMutation({
    mutationFn: async ({ orgId, reason }: { orgId: number; reason: string }) => {
      const res = await apiRequest("PATCH", `/api/organizations/${orgId}/reject`, {
        reason,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/system"] });
      toast({
        title: "Success",
        description: "Organization rejected successfully",
      });
      setRejectReason("");
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
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="approvals">Organization Approvals</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <SystemAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="approvals">
            <Card>
              <CardHeader>
                <CardTitle>Pending Organization Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {isLoadingOrgs ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingOrganizations?.map((org) => (
                        <div
                          key={org.id}
                          className="flex flex-col space-y-4 p-4 border rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{org.name}</p>
                              <p className="text-sm text-muted-foreground">{org.address}</p>
                              {org.description && (
                                <p className="text-sm mt-2">{org.description}</p>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                onClick={() => approveOrgMutation.mutate(org.id)}
                                disabled={approveOrgMutation.isPending}
                              >
                                {approveOrgMutation.isPending && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Approve
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive">
                                    <AlertCircle className="mr-2 h-4 w-4" />
                                    Reject
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Reject Organization</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to reject this organization? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <div className="py-4">
                                    <Label htmlFor="reason">Rejection Reason</Label>
                                    <Input
                                      id="reason"
                                      value={rejectReason}
                                      onChange={(e) => setRejectReason(e.target.value)}
                                      placeholder="Enter reason for rejection"
                                    />
                                  </div>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        rejectOrgMutation.mutate({
                                          orgId: org.id,
                                          reason: rejectReason,
                                        })
                                      }
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {rejectOrgMutation.isPending && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      )}
                                      Reject Organization
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      ))}
                      {!pendingOrganizations?.length && (
                        <p className="text-center text-muted-foreground">
                          No pending organizations
                        </p>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}