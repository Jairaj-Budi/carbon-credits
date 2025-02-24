import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommuteLogForm } from "@/components/commute-log-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNumber } from "@/lib/utils";
import { transportationMethods } from "@/lib/utils";
import { User, CommuteLog } from "@shared/schema";
import { format } from "date-fns";

export default function EmployeeDashboard() {
  const { user, logoutMutation } = useAuth();
  const { data: logs } = useQuery<CommuteLog[]>({ 
    queryKey: ["/api/commute-logs"]
  });

  const totalPoints = logs?.reduce((sum, log) => sum + Number(log.pointsEarned), 0) || 0;

  return (
    <div className="min-h-screen bg-background">
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
          <Card>
            <CardHeader>
              <CardTitle>My Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Total Points</dt>
                  <dd className="text-2xl font-bold">{formatNumber(totalPoints)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Commute Distance</dt>
                  <dd className="text-2xl font-bold">{formatNumber(user?.commuteDistance || 0)} mi</dd>
                </div>
              </dl>
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Commute Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {logs?.map((log) => {
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
                        <p className="font-medium">{formatNumber(log.pointsEarned)} pts</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
