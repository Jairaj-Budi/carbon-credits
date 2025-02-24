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

type OrgSummary = {
  methodDistribution: Record<string, number>;
  dailyTrend: Record<string, number>;
  employeePerformance: Array<{
    userId: number;
    name: string;
    totalPoints: number;
    commutesLogged: number;
    averagePoints: number;
  }>;
  summary: {
    totalEmployees: number;
    totalPoints: number;
    averagePointsPerEmployee: number;
    totalCommutes: number;
  };
};

type MarketplaceAnalytics = {
  currentListings: {
    active: number;
    totalCredits: number;
    averagePrice: number;
  };
  salesHistory: {
    totalSales: number;
    totalCredits: number;
    totalValue: number;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
  };
  trends: {
    sales: Record<string, { credits: number; value: number }>;
  };
};

export function AnalyticsDashboard() {
  const { data: orgSummary, isLoading: isLoadingOrg } = useQuery<OrgSummary>({
    queryKey: ["/api/analytics/organization-summary"],
  });

  const { data: marketplaceAnalytics, isLoading: isLoadingMarket } = useQuery<MarketplaceAnalytics>({
    queryKey: ["/api/analytics/marketplace"],
  });

  if (isLoadingOrg || isLoadingMarket) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Transform data for charts
  const methodDistribution = orgSummary?.methodDistribution ? 
    Object.entries(orgSummary.methodDistribution).map(([name, value]) => ({
      name,
      value
    })) : [];

  const dailyTrend = orgSummary?.dailyTrend ?
    Object.entries(orgSummary.dailyTrend).map(([date, points]) => ({
      date,
      points
    })) : [];

  const salesTrend = marketplaceAnalytics?.trends.sales ?
    Object.entries(marketplaceAnalytics.trends.sales).map(([month, data]) => ({
      month,
      credits: data.credits,
      value: data.value
    })) : [];

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgSummary?.summary.totalEmployees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(orgSummary?.summary.totalPoints ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Points/Employee</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(orgSummary?.summary.averagePointsPerEmployee ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(marketplaceAnalytics?.salesHistory.totalValue ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Commute Methods Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {methodDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Points Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="points" stroke="#2563eb" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" orientation="left" stroke="#2563eb" />
                  <YAxis yAxisId="right" orientation="right" stroke="#16a34a" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="credits" fill="#2563eb" name="Credits" />
                  <Bar yAxisId="right" dataKey="value" fill="#16a34a" name="Value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {orgSummary?.employeePerformance.slice(0, 5).map((employee, index) => (
                  <div key={employee.userId} className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-bold text-primary">{index + 1}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">{employee.name}</p>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{employee.commutesLogged} commutes</span>
                        <span>{formatNumber(employee.totalPoints)} pts</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
