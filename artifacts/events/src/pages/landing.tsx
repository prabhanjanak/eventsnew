import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.userType === "participant") setLocation("/participant/dashboard");
      else if (user.userType === "admin" || (user.userType as string) === "super_admin" || user.userType === "coordinator_view_only") setLocation("/admin/dashboard");
      else if (user.userType === "track_coordinator") setLocation("/coordinator/dashboard");
      else if (user.userType === "food_coordinator") setLocation("/admin/food-scanner");
      else if (user.userType === "scientific_committee") setLocation("/scientific/submissions");
    } else if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Redirecting...</p>
      </div>
    </div>
  );
}
