
import { Bell, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";

interface NavbarProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  userMenuSlot?: React.ReactNode;
}

const Navbar = ({ sidebarOpen, toggleSidebar, userMenuSlot }: NavbarProps) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 glass-effect">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle sidebar"
        className="md:hidden"
        onClick={toggleSidebar}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
      <div className="hidden md:block">
        <h1 className="text-xl font-semibold text-foreground">FlowTechs</h1>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="rounded-full relative"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary"></span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="text-sm font-medium">Notifications</div>
            <div className="mt-2 text-sm text-muted-foreground">
              You have no new notifications.
            </div>
          </PopoverContent>
        </Popover>

        <ThemeToggle />

        {userMenuSlot || (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="User menu"
                className="rounded-full"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-xs">FT</AvatarFallback>
                </Avatar>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-4" align="end">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Demo User</p>
                <p className="text-xs text-muted-foreground">user@example.com</p>
              </div>
              <div className="mt-4 space-y-2">
                <Link
                  to="/settings"
                  className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                >
                  Settings
                </Link>
                <Link
                  to="/auth/signin"
                  className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                >
                  Log out
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  );
};

export default Navbar;
