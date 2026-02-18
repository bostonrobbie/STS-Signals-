import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Shield } from "lucide-react";

interface RiskDisclaimerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  strategyName: string;
}

export function RiskDisclaimerModal({
  open,
  onOpenChange,
  onAccept,
  strategyName,
}: RiskDisclaimerModalProps) {
  const [acknowledgments, setAcknowledgments] = useState({
    pastPerformance: false,
    capitalRisk: false,
    noGuarantee: false,
    ownResearch: false,
    suitability: false,
  });

  const allChecked = Object.values(acknowledgments).every(Boolean);

  const handleAccept = () => {
    if (allChecked) {
      onAccept();
      // Reset for next time
      setAcknowledgments({
        pastPerformance: false,
        capitalRisk: false,
        noGuarantee: false,
        ownResearch: false,
        suitability: false,
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset when closing
      setAcknowledgments({
        pastPerformance: false,
        capitalRisk: false,
        noGuarantee: false,
        ownResearch: false,
        suitability: false,
      });
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-6 w-6 text-amber-500" />
            Risk Disclosure
          </DialogTitle>
          <DialogDescription className="text-base">
            Before subscribing to{" "}
            <span className="font-semibold text-foreground">
              {strategyName}
            </span>
            , please acknowledge the following risk disclosures.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 my-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-semibold mb-1">Important Warning</p>
              <p>
                Trading futures involves substantial risk of loss and is not
                suitable for all investors. You should carefully consider
                whether trading is appropriate for you in light of your
                circumstances, knowledge, and financial resources.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="pastPerformance"
              checked={acknowledgments.pastPerformance}
              onCheckedChange={checked =>
                setAcknowledgments(prev => ({
                  ...prev,
                  pastPerformance: checked === true,
                }))
              }
            />
            <Label
              htmlFor="pastPerformance"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I understand that{" "}
              <span className="font-semibold">
                past performance is not indicative of future results
              </span>
              . Historical returns shown are based on backtested or simulated
              data.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="capitalRisk"
              checked={acknowledgments.capitalRisk}
              onCheckedChange={checked =>
                setAcknowledgments(prev => ({
                  ...prev,
                  capitalRisk: checked === true,
                }))
              }
            />
            <Label
              htmlFor="capitalRisk"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I acknowledge that{" "}
              <span className="font-semibold">
                I may lose some or all of my invested capital
              </span>
              . Futures trading carries substantial risk and may result in
              significant losses.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="noGuarantee"
              checked={acknowledgments.noGuarantee}
              onCheckedChange={checked =>
                setAcknowledgments(prev => ({
                  ...prev,
                  noGuarantee: checked === true,
                }))
              }
            />
            <Label
              htmlFor="noGuarantee"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I understand that{" "}
              <span className="font-semibold">
                no trading strategy guarantees profits
              </span>
              . Market conditions can change, and strategies may underperform or
              fail.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="ownResearch"
              checked={acknowledgments.ownResearch}
              onCheckedChange={checked =>
                setAcknowledgments(prev => ({
                  ...prev,
                  ownResearch: checked === true,
                }))
              }
            />
            <Label
              htmlFor="ownResearch"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I confirm that I have{" "}
              <span className="font-semibold">conducted my own research</span>{" "}
              and am not relying solely on the information provided by this
              platform.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="suitability"
              checked={acknowledgments.suitability}
              onCheckedChange={checked =>
                setAcknowledgments(prev => ({
                  ...prev,
                  suitability: checked === true,
                }))
              }
            />
            <Label
              htmlFor="suitability"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I confirm that I have assessed whether this strategy is{" "}
              <span className="font-semibold">
                suitable for my financial situation
              </span>
              , investment objectives, and risk tolerance.
            </Label>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!allChecked}
            className={allChecked ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {allChecked
              ? "I Accept & Subscribe"
              : "Please acknowledge all items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
