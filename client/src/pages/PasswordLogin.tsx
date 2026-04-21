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
import { Loader2, AlertCircle, TrendingUp } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";

export default function PasswordLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await loginMutation.mutateAsync({
        email,
        password,
        rememberMe,
      });

      if (result.success) {
        // Store remember token if provided
        if (result.rememberToken) {
          localStorage.setItem("rememberToken", result.rememberToken);
          localStorage.setItem(
            "rememberTokenExpiry",
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          );
        }

        // Store user info
        localStorage.setItem("user", JSON.stringify(result.user));

        // Invalidate auth cache to refresh user data with new session
        await utils.auth.me.invalidate();

        // Redirect to returnTo or dashboard
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get("returnTo") || "/overview";

        // Use window.location for a full page reload to ensure session cookie is used
        window.location.href = returnTo;
      }
    } catch (err: any) {
      // Provide user-friendly error messages
      const errorMessage = err.message || "Login failed";
      if (errorMessage.includes("Invalid email or password")) {
        setError(
          "Invalid email or password. Please check your credentials and try again."
        );
      } else if (errorMessage.includes("OAuth")) {
        setError(
          "This account uses Google sign-in. Please use the Google login option."
        );
      } else if (
        errorMessage.includes("network") ||
        errorMessage.includes("fetch")
      ) {
        setError(
          "Network error. Please check your internet connection and try again."
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEOHead {...SEO_CONFIG.login} />
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
              Welcome Back
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Sign in to your Intraday Strategies account
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleLogin} className="space-y-5">
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
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={checked => setRememberMe(checked === true)}
                  disabled={isLoading}
                  className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label
                  htmlFor="rememberMe"
                  className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                >
                  Remember me
                </label>
              </div>
              <button
                type="button"
                onClick={() => setLocation("/forgot-password")}
                className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-11"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="text-center text-sm pt-2">
              <span className="text-muted-foreground">
                Don't have an account?{" "}
              </span>
              <button
                type="button"
                onClick={() => setLocation("/password-signup")}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign up
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
