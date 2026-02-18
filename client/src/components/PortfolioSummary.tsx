import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';

interface PortfolioSummaryProps {
  summary: string;
}

export function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-sm">
      <CardContent className="pt-6 pb-6">
        <div className="flex gap-4">
          <div className="p-2.5 bg-primary/15 rounded-xl flex-shrink-0 h-fit">
            <Info className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-primary mb-2 uppercase tracking-wide">
              Portfolio Summary
            </h3>
            <p className="text-base leading-relaxed text-foreground/90">
              {summary}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
