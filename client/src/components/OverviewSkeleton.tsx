import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function OverviewSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-pulse">
      {/* Header Card Skeleton */}
      <Card className="bg-gradient-to-br from-card to-card/50 border-2">
        <CardContent className="pt-4 sm:pt-6 space-y-4 sm:space-y-6 px-3 sm:px-6">
          {/* Title Skeleton */}
          <div className="text-center">
            <div className="h-8 sm:h-10 bg-muted rounded-lg w-64 mx-auto mb-2"></div>
            <div className="h-4 bg-muted rounded w-48 mx-auto"></div>
          </div>

          {/* Controls Bar Skeleton */}
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl border-2 border-primary/20 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-28"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
            </div>
          </div>

          {/* Metrics Cards Grid Skeleton */}
          <div className="grid gap-1.5 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-muted/30 border border-muted rounded-lg p-2 sm:p-3 md:p-4"
              >
                <div className="h-3 bg-muted rounded w-20 mx-auto mb-2"></div>
                <div className="h-6 sm:h-8 bg-muted rounded w-16 mx-auto mb-1"></div>
                <div className="h-2 bg-muted rounded w-24 mx-auto"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Equity Curve Chart Skeleton */}
      <Card>
        <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
          <div className="h-6 bg-muted rounded w-40 mb-2"></div>
          <div className="h-4 bg-muted rounded w-64"></div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="h-[300px] sm:h-[400px] bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="h-4 bg-muted-foreground/20 rounded w-32 mx-auto"></div>
              <div className="h-3 bg-muted-foreground/20 rounded w-48 mx-auto"></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Underwater Chart Skeleton */}
      <Card>
        <CardHeader className="pb-2">
          <div className="h-5 bg-muted rounded w-48 mb-1"></div>
          <div className="h-3 bg-muted rounded w-56"></div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] bg-muted rounded-lg"></div>
        </CardContent>
      </Card>

      {/* Performance Breakdown Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-56 mb-2"></div>
          <div className="h-4 bg-muted rounded w-72"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-4 bg-muted rounded w-32"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-4 bg-muted rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Additional Cards Skeleton */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="h-6 bg-muted rounded w-40"></div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] bg-muted rounded-lg"></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-6 bg-muted rounded w-40"></div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] bg-muted rounded-lg"></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
