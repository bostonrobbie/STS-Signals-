import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, TrendingUp, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function NotFound() {
  const [location] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-lg mx-4 shadow-lg border-border bg-card">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-destructive/20 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-destructive" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>

          <h2 className="text-xl font-semibold text-muted-foreground mb-4">
            Page Not Found
          </h2>

          <p className="text-muted-foreground mb-2 leading-relaxed">
            The page <code className="bg-muted px-2 py-1 rounded text-sm">{location}</code> doesn't exist.
          </p>
          <p className="text-muted-foreground mb-8 text-sm">
            It may have been moved, deleted, or you may have mistyped the URL.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="default">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/strategies">
                <TrendingUp className="w-4 h-4 mr-2" />
                View Strategies
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/my-dashboard">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                My Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
