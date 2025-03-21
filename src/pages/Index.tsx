
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-3xl p-6">
        <h1 className="text-4xl font-bold mb-4">Welcome to FlowTechs</h1>
        <p className="text-xl text-muted-foreground">
          Your all-in-one data pipeline management system
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          {user ? (
            <Button asChild size="lg">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link to="/auth/signin">Sign In</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/auth/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
