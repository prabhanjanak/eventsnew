import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import CircleCursor from "@/components/originkit/ui/circle-cursor";

import EventsDirectory from "@/pages/events";
import EventDetailPage from "@/pages/events/event-detail";
import EventRegisterPage from "@/pages/events/register";
import MyRegistrationsPage from "@/pages/events/my-registrations";
import EventsManager from "@/pages/admin/events-manager";

import Login from "@/pages/login";
import SetPassword from "@/pages/set-password";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import FileSubmissionPortal from "@/pages/file-submission";
import BrochurePage from "@/pages/brochure";
import PublicAgenda from "@/pages/public-agenda";
import SmartQR from "@/pages/q";
import NotFound from "@/pages/not-found";
import FlyerPage from "@/pages/flyer";
import TracksPage from "@/pages/tracks";
import LiveDashboard from "@/pages/live-dashboard";

import ParticipantDashboard from "@/pages/participant/dashboard";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminParticipants from "@/pages/admin/participants";
import AdminCrewVendors from "@/pages/admin/crew-vendors";
import AdminOnSpot from "@/pages/admin/on-spot";
import AdminParticipantDetail from "@/pages/admin/participants/detail";
import FoodSessions from "@/pages/admin/food-sessions";
import FoodScanner from "@/pages/admin/food-scanner";
import FoodLogs from "@/pages/admin/food-logs";
import AttendanceScanner from "@/pages/admin/attendance-scanner";
import AttendanceLogs from "@/pages/admin/attendance-logs";
import SystemUsers from "@/pages/admin/system-users";
import EventStaffPage from "@/pages/admin/event-staff";
import AdminSettings from "@/pages/admin/settings";
import AdminLogs from "@/pages/admin/logs";
import AdminSessions from "@/pages/admin/sessions";
import AdminSubmissions from "@/pages/admin/submissions";
import AdminEventSessions from "@/pages/admin/event-sessions";
import AdminSyncSessions from "@/pages/admin/sync-sessions";
import TrafficMonitor from "@/pages/admin/traffic-monitor";
import WhatsAppBroadcast from "@/pages/admin/whatsapp-broadcast";
import CoordinatorDashboard from "@/pages/coordinator/dashboard";
import FoodCoordinatorDashboard from "@/pages/food/dashboard";
import ScientificSubmissions from "@/pages/scientific/submissions";
import StaffChangePassword from "@/pages/staff/change-password";

// Wire the stored JWT into every generated API hook so useGetMe etc. send auth headers
setAuthTokenGetter(() => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("auth_token");
    if (urlToken) {
      localStorage.setItem("vision2020_token", urlToken);
      return urlToken;
    }
    return localStorage.getItem("vision2020_token");
  }
  return null;
});

const queryClient = new QueryClient();

import { EventProvider } from "@/hooks/use-active-event";

function Router() {
  return (
    <Switch>
      <Route path="/" component={EventsDirectory} />
      <Route path="/events" component={EventsDirectory} />
      <Route path="/events/:slug/register" component={EventRegisterPage} />
      <Route path="/events/:slug" component={EventDetailPage} />
      <Route path="/my-registrations" component={EventsDirectory} />

      <Route path="/login" component={Login} />
      <Route path="/set-password" component={SetPassword} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/file-submission" component={FileSubmissionPortal} />
      <Route path="/brochurev2020" component={BrochurePage} />

      {/* Participant / Faculty */}
      <Route path="/participant/dashboard">
        {() => <AppLayout><ParticipantDashboard /></AppLayout>}
      </Route>

      {/* Admin Events Management — Main Command Center */}
      <Route path="/admin">
        {() => <AppLayout><EventsManager /></AppLayout>}
      </Route>
      <Route path="/admin/events">
        {() => <AppLayout><EventsManager /></AppLayout>}
      </Route>

      {/* Admin Operations */}
      <Route path="/admin/dashboard">
        {() => <AppLayout><AdminDashboard /></AppLayout>}
      </Route>
      <Route path="/admin/participants">
        {() => <AppLayout><AdminParticipants /></AppLayout>}
      </Route>
      <Route path="/admin/crew-vendors">
        {() => <AppLayout><AdminCrewVendors /></AppLayout>}
      </Route>
      <Route path="/admin/on-spot">
        {() => <AppLayout><AdminOnSpot /></AppLayout>}
      </Route>
      <Route path="/admin/participants/:id">
        {() => <AppLayout><AdminParticipantDetail /></AppLayout>}
      </Route>
      <Route path="/admin/food-sessions">
        {() => <AppLayout><FoodSessions /></AppLayout>}
      </Route>
      <Route path="/admin/food-scanner">
        {() => <AppLayout><FoodScanner /></AppLayout>}
      </Route>
      <Route path="/admin/food-logs">
        {() => <AppLayout><FoodLogs /></AppLayout>}
      </Route>
      <Route path="/admin/attendance-scanner">
        {() => <AppLayout><AttendanceScanner /></AppLayout>}
      </Route>
      <Route path="/admin/attendance-logs">
        {() => <AppLayout><AttendanceLogs /></AppLayout>}
      </Route>
      <Route path="/admin/event-staff">
        {() => <AppLayout><EventStaffPage /></AppLayout>}
      </Route>
      <Route path="/admin/system-users">
        {() => <AppLayout><SystemUsers /></AppLayout>}
      </Route>
      <Route path="/admin/settings">
        {() => <AppLayout><AdminSettings /></AppLayout>}
      </Route>
      <Route path="/admin/logs">
        {() => <AppLayout><AdminLogs /></AppLayout>}
      </Route>
      <Route path="/admin/sync-sessions">
        {() => <AppLayout><AdminSyncSessions /></AppLayout>}
      </Route>
      <Route path="/admin/sessions">
        {() => <AppLayout><AdminSessions /></AppLayout>}
      </Route>
      <Route path="/admin/event-sessions">
        {() => <AppLayout><AdminEventSessions /></AppLayout>}
      </Route>
      <Route path="/admin/traffic">
        {() => <AppLayout><TrafficMonitor /></AppLayout>}
      </Route>
      <Route path="/admin/whatsapp">
        {() => <AppLayout><WhatsAppBroadcast /></AppLayout>}
      </Route>

      {/* Track Coordinator — both paths work */}
      <Route path="/track/dashboard">
        {() => <AppLayout><CoordinatorDashboard /></AppLayout>}
      </Route>
      <Route path="/coordinator/dashboard">
        {() => <AppLayout><CoordinatorDashboard /></AppLayout>}
      </Route>

      {/* Food Coordinator */}
      <Route path="/food/dashboard" component={FoodCoordinatorDashboard} />

      {/* Staff force-reset */}
      <Route path="/staff/change-password" component={StaffChangePassword} />

      {/* Public */}
      <Route path="/agenda" component={PublicAgenda} />
      <Route path="/agenda/:registrationNumber" component={PublicAgenda} />
      <Route path="/q/:regNumber" component={SmartQR} />
      <Route path="/flyer" component={FlyerPage} />
      <Route path="/tracks-rsvp" component={FlyerPage} />
      <Route path="/tracks" component={TracksPage} />
      <Route path="/live" component={LiveDashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

import { ErrorBoundary } from "@/components/error-boundary";

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <AuthProvider>
              <EventProvider>
                <Router />
              </EventProvider>
            </AuthProvider>
          </WouterRouter>
          <Toaster />
          {/* Originkit Ambient Circle Cursor Follower */}
          <div className="hidden lg:block fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
            <CircleCursor />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
