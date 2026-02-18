import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function UserPreferences() {
  // @ts-expect-error TS2339
  const { theme, setTheme } = useTheme();

  // Local state for preferences
  const [contractSize, setContractSize] = useState<"micro" | "mini">("mini");
  const [accountSize, setAccountSize] = useState<number>(100000);
  const [preferredTimezone, setPreferredTimezone] =
    useState<string>("America/New_York");

  // Load user preferences from backend
  // @ts-expect-error TS6133 unused
  const { data: preferences, isLoading } =
    trpc.userPreferences.getPreferences.useQuery(undefined, {
      // @ts-expect-error TS2769
      onSuccess: (data: any) => {
        if (data) {
          setContractSize(data.contractSize || "mini");
          setAccountSize(data.accountValue || 100000);
          setPreferredTimezone(data.timezone || "America/New_York");
          if (data.theme) {
            setTheme(data.theme);
          }
        }
      },
    });

  // Save preferences mutation
  const savePreferencesMutation =
    trpc.userPreferences.updatePreferences.useMutation({
      onSuccess: () => {
        toast.success("Preferences saved successfully");
      },
      onError: error => {
        toast.error(`Failed to save preferences: ${error.message}`);
      },
    });

  const handleSave = () => {
    savePreferencesMutation.mutate({
      // @ts-expect-error TS2353
      contractSize,
      accountValue: accountSize,
      timezone: preferredTimezone,
      theme: theme as "light" | "dark",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">User Preferences</h1>
        </div>
        <div className="text-center text-muted-foreground">
          Loading preferences...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">User Preferences</h1>
      </div>

      <div className="space-y-6">
        {/* Trading Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Trading Preferences</CardTitle>
            <CardDescription>
              Set your default contract size and account value for portfolio
              calculations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contractSize">Default Contract Size</Label>
              <Select
                value={contractSize}
                onValueChange={value =>
                  setContractSize(value as "micro" | "mini")
                }
              >
                <SelectTrigger id="contractSize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="micro">Micro Contracts</SelectItem>
                  <SelectItem value="mini">Mini Contracts</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Micro: $5/point • Mini: $50/point
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountSize">Default Account Size ($)</Label>
              <Input
                id="accountSize"
                type="number"
                value={accountSize}
                onChange={e => setAccountSize(Number(e.target.value))}
                min={1000}
                step={1000}
              />
              <p className="text-xs text-muted-foreground">
                Used for position sizing and risk calculations
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Display Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Display Preferences</CardTitle>
            <CardDescription>
              Customize how data is displayed across the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={theme}
                onValueChange={value => setTheme(value as "light" | "dark")}
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light Mode</SelectItem>
                  <SelectItem value="dark">Dark Mode</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose your preferred color scheme
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Preferred Timezone</Label>
              <Select
                value={preferredTimezone}
                onValueChange={setPreferredTimezone}
              >
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">
                    Eastern (EST/EDT)
                  </SelectItem>
                  <SelectItem value="America/Chicago">
                    Central (CST/CDT)
                  </SelectItem>
                  <SelectItem value="America/Denver">
                    Mountain (MST/MDT)
                  </SelectItem>
                  <SelectItem value="America/Los_Angeles">
                    Pacific (PST/PDT)
                  </SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Europe/London">
                    London (GMT/BST)
                  </SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                  <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                All timestamps will be displayed in this timezone
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={(savePreferencesMutation as any).isLoading}
            size="lg"
          >
            <Save className="h-4 w-4 mr-2" />
            {(savePreferencesMutation as any).isLoading
              ? "Saving..."
              : "Save Preferences"}
          </Button>
        </div>
      </div>
    </div>
  );
}
