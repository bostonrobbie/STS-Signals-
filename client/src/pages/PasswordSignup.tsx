import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Loader2, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
import { trackGASignUp } from "../components/GoogleAnalytics";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";

export default function PasswordSignup() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const signupMutation = trpc.auth.signup.useMutation();

  const validatePassword = (pwd: string) => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(pwd)) errors.push("One uppercase letter");
    if (!/[a-z]/.test(pwd)) errors.push("One lowercase letter");
    if (!/[0-9]/.test(pwd)) errors.push("One number");
    setPasswordErrors(errors);
    return errors.length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!validatePassword(password)) {
      setError("Password does not meet requirements");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signupMutation.mutateAsync({
        email,
        name,
        password,
      });

      if (result.success) {
        // Store user info
        localStorage.setItem("user", JSON.stringify(result.user));

        // Fire GA4 sign_up conversion event
        trackGASignUp("email");

        // Redirect new users to checkout (they must pay before accessing dashboard)
        setLocation("/pricing");
      }
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEOHead {...SEO_CONFIG.signup} />
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 pointer-events-none" />

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/95 backdrop-blur-sm shadow-2xl">
        <CardHeader className="space-y-4 text-center pb-2">
          {/* Logo/Brand */}
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Create Account
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Join Intraday Strategies today
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <Alert
                variant="destructive"
                className="bg-destructive/10 border-destructive/30"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Full Name
              </label>
              <Input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isLoading}
                required
                className="bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                required
                className="bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  validatePassword(e.target.value);
                }}
                disabled={isLoading}
                required
                className="bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              />
              {password && (
                <div className="text-xs space-y-1">
                  {passwordErrors.length > 0 ? (
                    <div className="text-destructive">
                      <p className="font-medium">Password must include:</p>
                      {passwordErrors.map(err => (
                        <p key={err}>• {err}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="text-primary flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Strong password
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
                className="bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-11"
              disabled={isLoading || passwordErrors.length > 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Sign Up"
              )}
            </Button>

            <div className="text-center text-sm pt-2">
              <span className="text-muted-foreground">
                Already have an account?{" "}
              </span>
              <button
                type="button"
                onClick={() => setLocation("/password-login")}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign in
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
