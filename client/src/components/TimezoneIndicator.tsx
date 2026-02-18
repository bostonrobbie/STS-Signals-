import { Clock } from "lucide-react";
import { getTimezoneDisplay } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";

export function TimezoneIndicator() {
  const timezone = getTimezoneDisplay();

  return (
    <Badge variant="outline" className="text-xs font-normal">
      <Clock className="h-3 w-3 mr-1" />
      {timezone}
    </Badge>
  );
}
