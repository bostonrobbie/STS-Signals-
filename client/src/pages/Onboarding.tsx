import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Bell,
  Shield,
  Target,
  BarChart3,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

type Step = "welcome" | "strategies" | "preferences" | "complete";

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [selectedStrategies, setSelectedStrategies] = useState<number[]>([]);
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    riskAcknowledged: false,
  });

  // Fetch available strategies
  const { data: strategies } = trpc.subscription.availableStrategies.useQuery();

  // Complete onboarding mutation
  // @ts-expect-error TS2339
  const completeOnboarding = trpc.auth.completeOnboarding.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Welcome aboard!", {
        description: "Your account is all set up. Let's start trading!",
      });
      setLocation("/my-dashboard");
    },
    onError: (error: any) => {
      toast.error("Failed to complete setup", {
        description: error.message,
      });
    },
  });

  // Subscribe to strategies mutation
  const subscribeToStrategy = trpc.subscription.subscribe.useMutation();

  const steps: { id: Step; title: string; description: string }[] = [
    {
      id: "welcome",
      title: "Welcome",
      description: "Get started with Intraday Strategies",
    },
    {
      id: "strategies",
      title: "Choose Strategies",
      description: "Select strategies to follow",
    },
    {
      id: "preferences",
      title: "Preferences",
      description: "Set up your notifications",
    },
    { id: "complete", title: "Complete", description: "You're all set!" },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = async () => {
    const stepOrder: Step[] = [
      "welcome",
      "strategies",
      "preferences",
      "complete",
    ];
    const currentIndex = stepOrder.indexOf(currentStep);

    if (currentStep === "strategies" && selectedStrategies.length > 0) {
      // Subscribe to selected strategies
      for (const strategyId of selectedStrategies) {
        try {
          await subscribeToStrategy.mutateAsync({ strategyId });
        } catch (error) {
          // Ignore if already subscribed
        }
      }
    }

    if (currentStep === "preferences") {
      if (!preferences.riskAcknowledged) {
        toast.error("Please acknowledge the risk disclaimer to continue");
        return;
      }
    }

    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]!);
    }
  };

  const handleBack = () => {
    const stepOrder: Step[] = [
      "welcome",
      "strategies",
      "preferences",
      "complete",
    ];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]!);
    }
  };

  const handleComplete = () => {
    completeOnboarding.mutate();
  };

  const toggleStrategy = (strategyId: number) => {
    setSelectedStrategies(prev =>
      prev.includes(strategyId)
        ? prev.filter(id => id !== strategyId)
        : [...prev, strategyId]
    );
  };

  // Redirect if already onboarded
  useEffect(() => {
    // @ts-expect-error TS2339
    if (user?.onboardingCompleted) {
      setLocation("/my-dashboard");
    }
  }, [user, setLocation]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${index < steps.length - 1 ? "flex-1" : ""}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index <= currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index < currentStepIndex ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded ${
                      index < currentStepIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        {/* Step Content */}
        <Card className="border-border/50">
          {currentStep === "welcome" && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">
                  Welcome, {user.name || "Trader"}!
                </CardTitle>
                <CardDescription className="text-base">
                  Let's get your account set up in just a few steps
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <TrendingUp className="h-6 w-6 text-primary mt-0.5" />
                    <div>
                      <h3 className="font-medium">Proven Strategies</h3>
                      <p className="text-sm text-muted-foreground">
                        Access algorithmic trading strategies with 14+ years of
                        backtested data
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <Bell className="h-6 w-6 text-primary mt-0.5" />
                    <div>
                      <h3 className="font-medium">Real-Time Signals</h3>
                      <p className="text-sm text-muted-foreground">
                        Get instant notifications when trades are executed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <BarChart3 className="h-6 w-6 text-primary mt-0.5" />
                    <div>
                      <h3 className="font-medium">Advanced Analytics</h3>
                      <p className="text-sm text-muted-foreground">
                        Track your portfolio performance with detailed metrics
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {currentStep === "strategies" && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">
                  Choose Your Strategies
                </CardTitle>
                <CardDescription className="text-base">
                  Select the strategies you want to follow (you can change this
                  later)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {strategies?.map((strategy: any) => (
                    <div
                      key={strategy.id}
                      onClick={() => toggleStrategy(strategy.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedStrategies.includes(strategy.id)
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedStrategies.includes(strategy.id)}
                            onCheckedChange={() => toggleStrategy(strategy.id)}
                          />
                          <div>
                            <h3 className="font-medium">{strategy.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {strategy.symbol} • {strategy.assetClass}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {strategy.direction}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedStrategies.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    {selectedStrategies.length} strateg
                    {selectedStrategies.length === 1 ? "y" : "ies"} selected
                  </p>
                )}
              </CardContent>
            </>
          )}

          {currentStep === "preferences" && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Set Your Preferences</CardTitle>
                <CardDescription className="text-base">
                  Configure notifications and acknowledge important information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label
                          htmlFor="email-notifications"
                          className="font-medium"
                        >
                          Email Notifications
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Receive trade alerts via email
                        </p>
                      </div>
                    </div>
                    <Checkbox
                      id="email-notifications"
                      checked={preferences.emailNotifications}
                      onCheckedChange={checked =>
                        setPreferences(p => ({
                          ...p,
                          emailNotifications: !!checked,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-amber-500/50 bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="risk-acknowledgment"
                      checked={preferences.riskAcknowledged}
                      onCheckedChange={checked =>
                        setPreferences(p => ({
                          ...p,
                          riskAcknowledged: !!checked,
                        }))
                      }
                    />
                    <div>
                      <Label
                        htmlFor="risk-acknowledgment"
                        className="font-medium text-amber-600"
                      >
                        Risk Acknowledgment
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        I understand that trading involves substantial risk of
                        loss and is not suitable for all investors. Past
                        performance is not indicative of future results. I will
                        only trade with capital I can afford to lose.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {currentStep === "complete" && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 p-4 rounded-full bg-green-500/10 w-fit">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle className="text-2xl">You're All Set!</CardTitle>
                <CardDescription className="text-base">
                  Your account is ready. Start exploring your dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Account created successfully</span>
                  </div>
                  {selectedStrategies.length > 0 && (
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                      <Check className="h-5 w-5 text-green-500" />
                      <span>
                        {selectedStrategies.length} strategies subscribed
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Preferences saved</span>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <p>
                    You can always update your strategies and preferences from
                    your dashboard.
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {/* Navigation Buttons */}
          <div className="p-6 pt-0 flex justify-between">
            {currentStep !== "welcome" && currentStep !== "complete" ? (
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {currentStep === "complete" ? (
              <Button onClick={handleComplete} className="ml-auto">
                Go to Dashboard
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleNext} className="ml-auto">
                {currentStep === "preferences" ? "Complete Setup" : "Continue"}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
