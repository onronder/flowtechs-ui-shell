
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { UserMenu } from "@/components/auth/UserMenu";
import { cn } from "@/lib/utils";
import { useMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const DashboardLayout = () => {
  const isMobile = useMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar 
        isSidebarOpen={sidebarOpen} 
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        userMenuSlot={<UserMenu />}
      />
      <div className="flex flex-1 overflow-hidden bg-background">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main
          className={cn(
            "flex-1 overflow-y-auto p-4 transition-all duration-200 ease-in-out",
            sidebarOpen && !isMobile ? "ml-64" : "ml-0"
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
