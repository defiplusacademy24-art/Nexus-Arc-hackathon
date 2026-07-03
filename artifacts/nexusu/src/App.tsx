import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UnicityProvider } from '@/providers/UnicityProvider';
import { Route, Switch, Router as WouterRouter } from 'wouter';

// Pages
import Home from '@/pages/home';
import AppPage from '@/pages/app';
import Onboarding from '@/pages/onboarding';
import NotFound from '@/pages/not-found';

// Dashboard pages
import Overview from '@/pages/dashboard/index';
import Cooperatives from '@/pages/dashboard/cooperatives';
import Members from '@/pages/dashboard/members';
import Treasury from '@/pages/dashboard/treasury';
import Savings from '@/pages/dashboard/savings';
import Loans from '@/pages/dashboard/loans';
import NexaPage from '@/pages/dashboard/nexa';
import Governance from '@/pages/dashboard/governance';
import Analytics from '@/pages/dashboard/analytics';
import Notifications from '@/pages/dashboard/notifications';
import SettingsPage from '@/pages/dashboard/settings';
import WalletProfile from '@/pages/dashboard/wallet';
import ProfilePage from '@/pages/dashboard/profile';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Landing */}
      <Route path="/" component={Home} />

      {/* Auth flow */}
      <Route path="/app" component={AppPage} />
      <Route path="/onboarding" component={Onboarding} />

      {/* Dashboard */}
      <Route path="/dashboard" component={Overview} />
      <Route path="/dashboard/cooperatives" component={Cooperatives} />
      <Route path="/dashboard/members" component={Members} />
      <Route path="/dashboard/treasury" component={Treasury} />
      <Route path="/dashboard/savings" component={Savings} />
      <Route path="/dashboard/loans" component={Loans} />
      <Route path="/dashboard/nexa" component={NexaPage} />
      <Route path="/dashboard/governance" component={Governance} />
      <Route path="/dashboard/analytics" component={Analytics} />
      <Route path="/dashboard/notifications" component={Notifications} />
      <Route path="/dashboard/settings" component={SettingsPage} />
      <Route path="/dashboard/wallet" component={WalletProfile} />
      <Route path="/dashboard/profile" component={ProfilePage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <UnicityProvider>
                <Router />
              </UnicityProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
