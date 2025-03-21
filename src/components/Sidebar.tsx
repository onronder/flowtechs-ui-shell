
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  LayoutDashboard,
  Database,
  Table,
  Settings as SettingsIcon,
  SendToBack,
  Timer,
  HardDrive,
  Brain,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navigationItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    title: "Sources",
    icon: Database,
    href: "/sources",
  },
  {
    title: "Datasets",
    icon: Table,
    href: "/datasets",
  },
  {
    title: "Transformations",
    icon: SettingsIcon,
    href: "/transformations",
  },
  {
    title: "Destinations",
    icon: SendToBack,
    href: "/destinations",
  },
  {
    title: "Jobs",
    icon: Timer,
    href: "/jobs",
  },
  {
    title: "divider1",
    divider: true,
  },
  {
    title: "Data Storage",
    icon: HardDrive,
    href: "/data-storage",
  },
  {
    title: "AI Insights",
    icon: Brain,
    href: "/ai-insights",
  },
  {
    title: "divider2",
    divider: true,
  },
  {
    title: "Help",
    icon: HelpCircle,
    href: "/help",
  },
  {
    title: "Settings",
    icon: SettingsIcon,
    href: "/settings",
  },
];

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await signOut();
      // The redirect will be handled in the auth context
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };
  
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r bg-card transition-transform duration-300 ease-in-out sidebar-gradient md:relative",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-16"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {open ? (
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="rounded-md bg-primary p-1">
              <span className="text-primary-foreground text-lg font-bold">FT</span>
            </div>
            <span className="text-lg font-semibold">FlowTechs</span>
          </Link>
        ) : (
          <div className="mx-auto rounded-md bg-primary p-1">
            <span className="text-primary-foreground text-lg font-bold">FT</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(!open)}
          className="hidden md:flex"
        >
          {open ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {navigationItems.map((item, index) => {
            if (item.divider) {
              return <Separator key={index} className="my-2" />;
            }

            const isActive = location.pathname === item.href;
            
            return (
              <li key={index}>
                <Link
                  to={item.href}
                  className={cn(
                    "nav-item",
                    isActive && "nav-item-active",
                    !open && "justify-center px-2"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                  {open && <span>{item.title}</span>}
                </Link>
              </li>
            );
          })}
          
          {/* Logout item */}
          <li>
            <button
              onClick={handleLogout}
              className={cn(
                "nav-item w-full text-left",
                !open && "justify-center px-2"
              )}
            >
              <LogOut className="h-5 w-5" />
              {open && <span>Log Out</span>}
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
