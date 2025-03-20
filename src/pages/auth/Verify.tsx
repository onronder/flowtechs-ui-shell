
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const Verify = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
      setIsVerified(true);
      toast.success("Email verified successfully");
    }, 1000);
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
          Enter the verification code sent to your email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isVerified ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input id="code" placeholder="Enter 6-digit code" required />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Verify email"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-4 text-sm">
              Your email has been verified successfully.
            </div>
            <Button className="w-full" asChild>
              <Link to="/auth/signin">Continue to sign in</Link>
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        <div className="text-sm text-muted-foreground">
          Didn't receive a code?{" "}
          <Link to="#" className="text-primary hover:underline" onClick={(e) => {
            e.preventDefault();
            toast.success("Verification code resent");
          }}>
            Resend code
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
};

export default Verify;
