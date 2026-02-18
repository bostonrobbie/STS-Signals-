import { useContractSize } from '@/contexts/ContractSizeContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ContractSizeToggle() {
  const { contractSize, toggleContractSize } = useContractSize();

  return (
    <Card className="bg-muted/50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="contract-size-toggle" className="text-sm font-medium">
              Contract Size: <span className="font-bold">{contractSize === 'mini' ? 'Mini/Standard' : 'Micro'}</span>
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold">Contract Specifications:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• <strong>ES:</strong> Mini=$50/pt, Micro=$5/pt (10:1)</li>
                      <li>• <strong>NQ:</strong> Mini=$20/pt, Micro=$2/pt (10:1)</li>
                      <li>• <strong>CL:</strong> Mini=$1,000/bbl, Micro=$100/bbl (10:1)</li>
                      <li>• <strong>BTC:</strong> Mini=5 BTC, Micro=0.1 BTC (50:1)</li>
                      <li>• <strong>GC:</strong> Mini=100oz, Micro=10oz (10:1)</li>
                      <li>• <strong>YM:</strong> Mini=$5/pt, Micro=$0.50/pt (10:1)</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      Data is stored in Mini format. Toggle to view in Micro.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${contractSize === 'mini' ? 'font-semibold' : 'text-muted-foreground'}`}>
              Mini
            </span>
            <Switch
              id="contract-size-toggle"
              checked={contractSize === 'micro'}
              onCheckedChange={toggleContractSize}
            />
            <span className={`text-sm ${contractSize === 'micro' ? 'font-semibold' : 'text-muted-foreground'}`}>
              Micro
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
