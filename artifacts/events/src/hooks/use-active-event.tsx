import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export interface EventItem {
  id: number;
  title: string;
  slug: string;
  eventType: string;
  description?: string | null;
  venue?: string | null;
  city?: string | null;
  startDate: string;
  endDate: string;
  timeFrom?: string | null;
  timeTo?: string | null;
  isPaid: boolean;
  registrationFee?: number | null;
  status: string;
  totalParticipants?: number;
  totalRegistered?: number;
  pendingApprovals?: number;
  seatsLeft?: number;
  maxCapacity?: number | null;
  enableAttendance?: boolean;
  enableFood?: boolean;
  enableGoodies?: boolean;
  requiresApproval?: boolean;
  enableGoogleWallet?: boolean;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

interface EventContextType {
  activeEventId: number | null;
  activeEvent: EventItem | null;
  setActiveEventId: (id: number | null) => void;
  selectEvent: (event: EventItem) => void;
  clearActiveEvent: () => void;
  events: EventItem[];
  isLoadingEvents: boolean;
  refetchEvents: () => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

const ACTIVE_EVENT_STORAGE_KEY = "sankara_active_admin_event_id";

export function EventProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { token } = useAuth();

  // Query all events available to the staff/admin
  const { data: rawEvents, isLoading: isLoadingEvents, refetch: refetchEvents } = useQuery<EventItem[]>({
    queryKey: ["/api/events/all-admin", token],
    queryFn: async () => {
      const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("vision2020_token") : null);
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers["Authorization"] = `Bearer ${activeToken}`;
      }
      const res = await fetch(`${BASE_URL}/api/events`, { headers });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
  });

  const events = Array.isArray(rawEvents) ? rawEvents : [];

  const [activeEventId, setActiveEventIdState] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const urlEventId = params.get("eventId");
    if (urlEventId && !isNaN(Number(urlEventId))) {
      return Number(urlEventId);
    }
    const stored = localStorage.getItem(ACTIVE_EVENT_STORAGE_KEY);
    if (stored && !isNaN(Number(stored))) {
      return Number(stored);
    }
    return null;
  });

  // Watch location and URL search param changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlEventId = params.get("eventId");
      if (urlEventId && !isNaN(Number(urlEventId))) {
        const numId = Number(urlEventId);
        setActiveEventIdState(numId);
        localStorage.setItem(ACTIVE_EVENT_STORAGE_KEY, String(numId));
      }
    };

    checkUrl();
    window.addEventListener("popstate", checkUrl);
    return () => window.removeEventListener("popstate", checkUrl);
  }, [location]);

  // If activeEventId is set, find the corresponding event object
  const activeEvent = events.find((e) => e.id === activeEventId) || null;

  const setActiveEventId = (id: number | null) => {
    setActiveEventIdState(id);
    if (id !== null) {
      localStorage.setItem(ACTIVE_EVENT_STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(ACTIVE_EVENT_STORAGE_KEY);
    }
  };

  const selectEvent = (event: EventItem) => {
    setActiveEventId(event.id);
    setLocation(`/admin/dashboard?eventId=${event.id}`);
  };

  const clearActiveEvent = () => {
    setActiveEventId(null);
  };

  return (
    <EventContext.Provider
      value={{
        activeEventId,
        activeEvent,
        setActiveEventId,
        selectEvent,
        clearActiveEvent,
        events,
        isLoadingEvents,
        refetchEvents,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useActiveEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useActiveEvent must be used within an EventProvider");
  }
  return context;
}
