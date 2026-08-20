import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetMe, CurrentUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export type ExtendedUser = (CurrentUser & {
  userType?: string;
  email?: string;
  sessionTimeoutMinutes?: number;
}) | null;

interface AuthContextType {
  user: ExtendedUser;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: any, mustChangePassword?: boolean) => void;
  loginAttendee: (token: string, user: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => {
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
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const isPublicRoute = (path: string): boolean => {
    const cleanPath = path.toLowerCase().replace(/\/$/, "");
    const publics = ["", "/", "/events", "/login", "/set-password", "/forgot-password", "/reset-password", "/file-submission", "/tracks", "/flyer", "/tracks-rsvp", "/brochurev2020", "/my-registrations"];
    if (publics.includes(cleanPath)) return true;
    if (cleanPath.startsWith("/events") || cleanPath.startsWith("/agenda") || cleanPath.startsWith("/q/") || cleanPath.startsWith("/tracks") || cleanPath.startsWith("/my-registrations")) return true;
    return false;
  };

  // Ref for inactivity timer
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: user, isLoading: isMeLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    } as any
  });

  // Handle auto-redirect if not logged in on a protected route
  useEffect(() => {
    if (!token && !isPublicRoute(location)) {
      setLocation("/login");
    }
  }, [token, location]);

  useEffect(() => {
    if (error) {
      const status = (error as any).status || (error as any).statusCode;
      if (status === 401) {
        localStorage.removeItem("vision2020_token");
        setToken(null);
        if (!isPublicRoute(location)) {
          setLocation("/login");
        }
      }
    }
  }, [error, location]);

  // ─── Inactivity Auto-Logout (Only for Staff / Coordinators; Attendees stay logged in) ─────
  const handleActivity = () => {
    if (!inactivityTimer.current) return;
    clearTimeout(inactivityTimer.current);

    const timeoutMinutes = user?.sessionTimeoutMinutes ?? 30;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    inactivityTimer.current = setTimeout(() => {
      const storedToken = localStorage.getItem("vision2020_token");
      if (storedToken) {
        fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${storedToken}` },
        }).catch(() => {});
      }
      localStorage.removeItem("vision2020_token");
      setToken(null);
      setLocation("/login");
      toast({
        title: "Session expired",
        description: `You were automatically logged out after ${timeoutMinutes} minutes of inactivity.`,
        variant: "destructive",
      });
    }, timeoutMs);
  };

  useEffect(() => {
    if (!token || (user?.userType as string) === "attendee" || (user?.userType as string) === "participant") {
      // Clear timer for attendees (never logout until explicit logout)
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
      return;
    }

    const timeoutMinutes = user?.sessionTimeoutMinutes ?? 30;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    inactivityTimer.current = setTimeout(() => {
      const storedToken = localStorage.getItem("vision2020_token");
      if (storedToken) {
        fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${storedToken}` },
        }).catch(() => {});
      }
      localStorage.removeItem("vision2020_token");
      setToken(null);
      setLocation("/login");
      toast({
        title: "Session expired",
        description: `You were automatically logged out after ${timeoutMinutes} minutes of inactivity.`,
        variant: "destructive",
      });
    }, timeoutMs);

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
    };
  }, [token, user]);

  const login = (newToken: string, newUser: any, mustChangePassword?: boolean) => {
    localStorage.setItem("vision2020_token", newToken);
    setToken(newToken);
    queryClient.setQueryData(["/api/auth/me"], newUser);

    if (mustChangePassword && (newUser.userType as string) !== "participant" && (newUser.userType as string) !== "attendee") {
      setLocation("/staff/change-password");
      return;
    }

    // Route by role — Event Management is the main command center for staff
    switch (newUser.userType as string) {
      case "super_admin":
      case "admin":
      case "event_coordinator":
        setLocation("/admin/events");
        break;
      case "track_coordinator":
        setLocation("/track/dashboard");
        break;
      case "food_coordinator":
        setLocation("/admin/food-scanner");
        break;
      case "scientific_committee":
      case "pr_member":
        setLocation("/admin/event-sessions");
        break;
      case "attendee":
        setLocation("/my-registrations");
        break;
      default:
        setLocation("/participant/dashboard");
    }
  };

  const loginAttendee = (newToken: string, newUser: any) => {
    localStorage.setItem("vision2020_token", newToken);
    setToken(newToken);
    queryClient.setQueryData(["/api/auth/me"], newUser);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  const logout = () => {
    const storedToken = localStorage.getItem("vision2020_token");
    if (storedToken) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${storedToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem("vision2020_token");
    setToken(null);
    queryClient.setQueryData(["/api/auth/me"], null);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user: user || null, token, isLoading: !!token && isMeLoading, login, loginAttendee, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
