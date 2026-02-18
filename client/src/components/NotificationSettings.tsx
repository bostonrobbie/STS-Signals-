import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import {
  Bell,
  BellOff,
  Mail,
  Volume2,
  VolumeX,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Webhook,
  Calendar,
  Save,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export function NotificationSettings() {
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch notification preferences
  const {
    data: preferences,
    isLoading,
    refetch,
  } = trpc.notifications.getPreferences.useQuery();

  // Local state for form
  const [globalSettings, setGlobalSettings] = useState({
    globalMute: false,
    muteTradeExecuted: false,
    muteTradeError: false,
    mutePositionOpened: false,
    mutePositionClosed: false,
    muteWebhookFailed: false,
    muteDailyDigest: false,
    emailEnabled: true,
    emailAddress: "",
    inAppEnabled: true,
    soundEnabled: true,
  });

  const [strategySettings, setStrategySettings] = useState<
    Record<number, { emailEnabled: boolean; pushEnabled: boolean }>
  >({});

  // Update local state when data loads
  useEffect(() => {
    if (preferences) {
      setGlobalSettings({
        // @ts-expect-error TS2322
        globalMute: preferences.global.globalMute,
        // @ts-expect-error TS2322
        muteTradeExecuted: preferences.global.muteTradeExecuted,
        // @ts-expect-error TS2322
        muteTradeError: preferences.global.muteTradeError,
        // @ts-expect-error TS2322
        mutePositionOpened: preferences.global.mutePositionOpened,
        // @ts-expect-error TS2322
        mutePositionClosed: preferences.global.mutePositionClosed,
        // @ts-expect-error TS2322
        muteWebhookFailed: preferences.global.muteWebhookFailed,
        // @ts-expect-error TS2322
        muteDailyDigest: preferences.global.muteDailyDigest,
        // @ts-expect-error TS2322
        emailEnabled: preferences.global.emailEnabled,
        emailAddress: preferences.global.emailAddress || "",
        // @ts-expect-error TS2322
        inAppEnabled: preferences.global.inAppEnabled,
        // @ts-expect-error TS2322
        soundEnabled: preferences.global.soundEnabled,
      });

      const stratSettings: Record<
        number,
        { emailEnabled: boolean; pushEnabled: boolean }
      > = {};
      preferences.strategies.forEach(s => {
        stratSettings[s.id] = {
          emailEnabled: s.emailEnabled,
          pushEnabled: s.pushEnabled,
        };
      });
      setStrategySettings(stratSettings);
    }
  }, [preferences]);

  // Mutations
  const updateGlobalMutation =
    trpc.notifications.updateGlobalPreferences.useMutation({
      onSuccess: () => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        setHasChanges(false);
        refetch();
      },
    });

  const toggleStrategyMutation = trpc.notifications.toggleStrategy.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleGlobalChange = (
    key: keyof typeof globalSettings,
    value: boolean | string
  ) => {
    setGlobalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleStrategyToggle = (
    strategyId: number,
    field: "emailEnabled" | "pushEnabled",
    value: boolean
  ) => {
    setStrategySettings(prev => ({
      ...prev,
      [strategyId]: { ...prev[strategyId], [field]: value },
    }));

    toggleStrategyMutation.mutate({
      strategyId,
      [field]: value,
    });
  };

  const handleSaveGlobal = () => {
    updateGlobalMutation.mutate({
      globalMute: globalSettings.globalMute,
      muteTradeExecuted: globalSettings.muteTradeExecuted,
      muteTradeError: globalSettings.muteTradeError,
      mutePositionOpened: globalSettings.mutePositionOpened,
      mutePositionClosed: globalSettings.mutePositionClosed,
      muteWebhookFailed: globalSettings.muteWebhookFailed,
      muteDailyDigest: globalSettings.muteDailyDigest,
      emailEnabled: globalSettings.emailEnabled,
      emailAddress: globalSettings.emailAddress || null,
      inAppEnabled: globalSettings.inAppEnabled,
      soundEnabled: globalSettings.soundEnabled,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const strategies = preferences?.strategies || [];

  return (
    <div className="space-y-6">
      {/* Global Mute Toggle */}
      <Card
        className={
          globalSettings.globalMute
            ? "border-orange-500/50 bg-orange-500/5"
            : ""
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {globalSettings.globalMute ? (
              <BellOff className="h-5 w-5 text-orange-500" />
            ) : (
              <Bell className="h-5 w-5" />
            )}
            Global Mute
          </CardTitle>
          <CardDescription>
            Quickly silence all notifications with one toggle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full ${globalSettings.globalMute ? "bg-orange-500/10" : "bg-muted"}`}
              >
                {globalSettings.globalMute ? (
                  <BellOff className="h-4 w-4 text-orange-500" />
                ) : (
                  <Bell className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <Label className="font-medium">Mute All Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  {globalSettings.globalMute
                    ? "All notifications are currently muted"
                    : "Notifications are enabled"}
                </p>
              </div>
            </div>
            <Switch
              checked={globalSettings.globalMute}
              onCheckedChange={checked =>
                handleGlobalChange("globalMute", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Mail className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <Label className="font-medium">Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive alerts via email
                  </p>
                </div>
              </div>
              <Switch
                checked={globalSettings.emailEnabled}
                onCheckedChange={checked =>
                  handleGlobalChange("emailEnabled", checked)
                }
                disabled={globalSettings.globalMute}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <Bell className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <Label className="font-medium">In-App Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Show notifications in dashboard
                  </p>
                </div>
              </div>
              <Switch
                checked={globalSettings.inAppEnabled}
                onCheckedChange={checked =>
                  handleGlobalChange("inAppEnabled", checked)
                }
                disabled={globalSettings.globalMute}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-500/10">
                {globalSettings.soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-purple-500" />
                ) : (
                  <VolumeX className="h-4 w-4 text-purple-500" />
                )}
              </div>
              <div>
                <Label className="font-medium">Sound Effects</Label>
                <p className="text-xs text-muted-foreground">
                  Play sound when notifications arrive
                </p>
              </div>
            </div>
            <Switch
              checked={globalSettings.soundEnabled}
              onCheckedChange={checked =>
                handleGlobalChange("soundEnabled", checked)
              }
              disabled={globalSettings.globalMute}
            />
          </div>

          {globalSettings.emailEnabled && (
            <div className="space-y-2 pt-2">
              <Label>Email Address (optional override)</Label>
              <Input
                type="email"
                value={globalSettings.emailAddress}
                onChange={e =>
                  handleGlobalChange("emailAddress", e.target.value)
                }
                placeholder="Leave blank to use account email"
                disabled={globalSettings.globalMute}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Type Muting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Mute by Type
          </CardTitle>
          <CardDescription>
            Selectively mute specific notification types
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <Label>Trade Executed</Label>
              </div>
              <Switch
                checked={globalSettings.muteTradeExecuted}
                onCheckedChange={checked =>
                  handleGlobalChange("muteTradeExecuted", checked)
                }
                disabled={globalSettings.globalMute}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <Label>Trade Errors</Label>
              </div>
              <Switch
                checked={globalSettings.muteTradeError}
                onCheckedChange={checked =>
                  handleGlobalChange("muteTradeError", checked)
                }
                disabled={globalSettings.globalMute}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <Label>Position Opened</Label>
              </div>
              <Switch
                checked={globalSettings.mutePositionOpened}
                onCheckedChange={checked =>
                  handleGlobalChange("mutePositionOpened", checked)
                }
                disabled={globalSettings.globalMute}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                <Label>Position Closed</Label>
              </div>
              <Switch
                checked={globalSettings.mutePositionClosed}
                onCheckedChange={checked =>
                  handleGlobalChange("mutePositionClosed", checked)
                }
                disabled={globalSettings.globalMute}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-yellow-500" />
                <Label>Webhook Failed</Label>
              </div>
              <Switch
                checked={globalSettings.muteWebhookFailed}
                onCheckedChange={checked =>
                  handleGlobalChange("muteWebhookFailed", checked)
                }
                disabled={globalSettings.globalMute}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <Label>Daily Digest</Label>
              </div>
              <Switch
                checked={globalSettings.muteDailyDigest}
                onCheckedChange={checked =>
                  handleGlobalChange("muteDailyDigest", checked)
                }
                disabled={globalSettings.globalMute}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Toggle ON to mute that notification type. When muted, you won't
            receive those notifications.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveGlobal}
          disabled={!hasChanges || updateGlobalMutation.isPending}
          className="min-w-[140px]"
        >
          {updateGlobalMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Per-Strategy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Strategy Notifications
          </CardTitle>
          <CardDescription>
            Enable or disable notifications for each strategy individually
          </CardDescription>
        </CardHeader>
        <CardContent>
          {strategies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No strategies available. Subscribe to strategies to configure
              their notifications.
            </p>
          ) : (
            <div className="space-y-3">
              {strategies.map(strategy => (
                <div
                  key={strategy.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      {strategy.symbol}
                    </Badge>
                    <span className="font-medium">{strategy.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Switch
                        checked={
                          strategySettings[strategy.id]?.emailEnabled ?? true
                        }
                        onCheckedChange={checked =>
                          handleStrategyToggle(
                            strategy.id,
                            "emailEnabled",
                            checked
                          )
                        }
                        disabled={
                          globalSettings.globalMute ||
                          !globalSettings.emailEnabled
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <Switch
                        checked={
                          strategySettings[strategy.id]?.pushEnabled ?? true
                        }
                        onCheckedChange={checked =>
                          handleStrategyToggle(
                            strategy.id,
                            "pushEnabled",
                            checked
                          )
                        }
                        disabled={
                          globalSettings.globalMute ||
                          !globalSettings.inAppEnabled
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
