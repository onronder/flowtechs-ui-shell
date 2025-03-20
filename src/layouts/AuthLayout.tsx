
import { Outlet } from "react-router-dom";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

const AuthLayout = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-b from-background to-muted">
      <div className="fixed right-4 top-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label="Toggle theme"
          className="rounded-full"
        >
          {theme === "light" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </Button>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-scale-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
