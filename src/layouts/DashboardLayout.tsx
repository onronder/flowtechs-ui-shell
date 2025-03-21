
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { UserMenu } from "@/components/auth/UserMenu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const DashboardLayout = () => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar 
        sidebarOpen={sidebarOpen} 
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        userMenuSlot={<UserMenu />}
      />
      <div className="flex flex-1 overflow-hidden bg-background">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main
          className={cn(
            "flex-1 overflow-y-auto p-6 md:p-8 transition-all duration-200 ease-in-out",
            sidebarOpen && !isMobile ? "ml-64" : "ml-0",
            "flex flex-col"
          )}
        >
          <div className="max-w-screen-2xl w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
