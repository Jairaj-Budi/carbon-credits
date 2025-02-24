import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04"];

type SystemAnalytics = {
  totalOrganizations: number;
  totalUsers: number;
  totalCreditsTraded: number;
  totalTradingVolume: number;
  userGrowth: Record<string, number>;
  organizationGrowth: Record<string, number>;
  tradingActivity: Record<string, {
    credits: number;
    volume: number;
  }>;
  userDistribution: {
    employees: number;
    orgAdmins: number;
    systemAdmins: number;
  };
  platformStats: {
    totalCommutes: number;
    avgPointsPerCommute: number;
    activeListings: number;
    completedTrades: number;
  };
};

export function SystemAnalyticsDashboard() {
  const { data: analytics, isLoading } = useQuery<SystemAnalytics>({
    queryKey: ["/api/analytics/system"],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics) return null;

  // Transform data for charts
  const userGrowth = Object.entries(analytics.userGrowth).map(([date, count]) => ({
    date,
    users: count
  }));

  const orgGrowth = Object.entries(analytics.organizationGrowth).map(([date, count]) => ({
    date,
    organizations: count
  }));

  const tradingActivity = Object.entries(analytics.tradingActivity).map(([date, data]) => ({
    date,
    credits: data.credits,
    volume: data.volume
  }));

  const userDistribution = [
    { name: "Employees", value: analytics.userDistribution.employees },
    { name: "Org Admins", value: analytics.userDistribution.orgAdmins },
    { name: "System Admins", value: analytics.userDistribution.systemAdmins }
  ];

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalOrganizations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Traded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(analytics.totalCreditsTraded)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trading Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.totalTradingVolume)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="users" stroke="#2563eb" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={orgGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="organizations" stroke="#16a34a" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trading Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tradingActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" orientation="left" stroke="#2563eb" />
                  <YAxis yAxisId="right" orientation="right" stroke="#16a34a" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="credits" fill="#2563eb" name="Credits" />
                  <Bar yAxisId="right" dataKey="volume" fill="#16a34a" name="Volume" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={userDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {userDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Commutes</p>
              <p className="text-2xl font-bold">{formatNumber(analytics.platformStats.totalCommutes)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Avg Points/Commute</p>
              <p className="text-2xl font-bold">{formatNumber(analytics.platformStats.avgPointsPerCommute)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Listings</p>
              <p className="text-2xl font-bold">{analytics.platformStats.activeListings}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Completed Trades</p>
              <p className="text-2xl font-bold">{analytics.platformStats.completedTrades}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
