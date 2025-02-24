import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";

import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import EmployeeDashboard from "@/pages/employee-dashboard";
import OrgAdminDashboard from "@/pages/org-admin-dashboard";
import SystemAdminDashboard from "@/pages/system-admin-dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute 
        path="/" 
        component={() => {
          const { user } = useAuth();
          switch (user?.role) {
            case "employee":
              return <EmployeeDashboard />;
            case "org_admin":
              return <OrgAdminDashboard />;
            case "system_admin":
              return <SystemAdminDashboard />;
            default:
              return <NotFound />;
          }
        }} 
      />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
