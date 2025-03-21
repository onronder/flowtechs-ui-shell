
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const Verify = () => {
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isResending, setIsResending] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there's an email in local storage (stored during signup)
    const currentUser = supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setEmail(data.user.email);
      }
    });
  }, []);

  const handleResendEmail = async () => {
    if (!email) {
      setError("No email address found. Please try signing up again.");
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      
      if (error) {
        throw error;
      }
      
      toast.success("Verification email resent");
    } catch (error: any) {
      setError(error.message || "Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-6">
          <div className="rounded-md bg-primary p-2">
            <span className="text-primary-foreground text-xl font-bold">FT</span>
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Verify your email</CardTitle>
        <CardDescription className="text-center">
          We've sent a verification link to {email || "your email"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/15 p-3 rounded-md flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="rounded-md bg-muted p-4 space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Check your email</p>
                <p className="text-sm text-muted-foreground">Click the verification link in the email we sent you</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">After verification</p>
                <p className="text-sm text-muted-foreground">You'll be able to sign in to your account</p>
              </div>
            </div>
          </div>
          
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResendEmail}
            disabled={isResending}
          >
            {isResending ? "Sending..." : "Resend verification email"}
          </Button>
          
          <Button className="w-full" asChild>
            <Link to="/auth/signin">Back to sign in</Link>
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex justify-center">
        <div className="text-sm text-muted-foreground">
          Need help?{" "}
          <Link to="/help" className="text-primary hover:underline">
            Contact support
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
};

export default Verify;
