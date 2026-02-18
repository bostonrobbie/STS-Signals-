import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Play, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Webhook,
  Code,
  Copy,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface SimulationResult {
  success: boolean;
  message: string;
  correlationId: string;
  processingTimeMs: number;
  signalType?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export function WebhookSimulator() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    symbol: 'MESRenko',
    action: 'entry',
    direction: 'long',
    price: '5000.00',
    quantity: '1',
    isTest: true,
  });

  // Get strategies for symbol dropdown
  const { data: strategies } = trpc.subscription.availableStrategies.useQuery();

  // Simulate webhook mutation
  const simulateMutation = trpc.broker.simulateWebhook.useMutation({
    onSuccess: (data: SimulationResult) => {
      setResult(data);
      if (data.success) {
        toast.success('Webhook simulated successfully');
      } else {
        toast.error(`Simulation failed: ${data.error || data.message}`);
      }
    },
    onError: (error: { message: string }) => {
      setResult({
        success: false,
        message: error.message,
        correlationId: 'N/A',
        processingTimeMs: 0,
        error: error.message,
      });
      toast.error(`Simulation error: ${error.message}`);
    },
    onSettled: () => {
      setIsSimulating(false);
    },
  });

  const handleSimulate = () => {
    setIsSimulating(true);
    setResult(null);
    
    simulateMutation.mutate({
      symbol: formData.symbol,
      action: formData.action as 'entry' | 'exit',
      direction: formData.direction as 'long' | 'short',
      price: parseFloat(formData.price),
      quantity: parseInt(formData.quantity, 10),
      isTest: formData.isTest,
    });
  };

  const generatePayload = () => {
    return JSON.stringify({
      symbol: formData.symbol,
      action: formData.action,
      direction: formData.direction,
      price: parseFloat(formData.price),
      quantity: parseInt(formData.quantity, 10),
      timestamp: new Date().toISOString(),
      isTest: formData.isTest,
    }, null, 2);
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(generatePayload());
    toast.success('Payload copied to clipboard');
  };

  const strategySymbols: string[] = strategies?.map((s: { symbol: string }) => s.symbol) || ['MESRenko', 'NQTrend', 'ESMomentum'];

  return (
    <div className="space-y-6">
      {/* Simulator Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Simulator
          </CardTitle>
          <CardDescription>
            Test webhook processing without sending real signals from TradingView
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Strategy Symbol */}
            <div className="space-y-2">
              <Label>Strategy Symbol</Label>
              <Select
                value={formData.symbol}
                onValueChange={(value) => setFormData(prev => ({ ...prev, symbol: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  {strategySymbols.map((symbol) => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action */}
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={formData.action}
                onValueChange={(value) => setFormData(prev => ({ ...prev, action: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry (Open Position)</SelectItem>
                  <SelectItem value="exit">Exit (Close Position)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Direction */}
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={formData.direction}
                onValueChange={(value) => setFormData(prev => ({ ...prev, direction: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="5000.00"
              />
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="1"
              />
            </div>

            {/* Test Mode Toggle */}
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select
                value={formData.isTest ? 'test' : 'live'}
                onValueChange={(value) => setFormData(prev => ({ ...prev, isTest: value === 'test' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                        Test
                      </Badge>
                      Isolated test data
                    </span>
                  </SelectItem>
                  <SelectItem value="live">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                        Live
                      </Badge>
                      Real trade data
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleSimulate} 
              disabled={isSimulating}
              className="min-w-[160px]"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Simulate Webhook
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowRawPayload(!showRawPayload)}
            >
              <Code className="h-4 w-4 mr-2" />
              {showRawPayload ? 'Hide' : 'Show'} Payload
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                setFormData({
                  symbol: 'MESRenko',
                  action: 'entry',
                  direction: 'long',
                  price: '5000.00',
                  quantity: '1',
                  isTest: true,
                });
                setResult(null);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Raw Payload Preview */}
          {showRawPayload && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Raw Payload</Label>
                <Button variant="ghost" size="sm" onClick={copyPayload}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              <Textarea
                readOnly
                value={generatePayload()}
                className="font-mono text-sm h-40"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result Display */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Simulation Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant={result.success ? 'default' : 'destructive'}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle>{result.success ? 'Success' : 'Failed'}</AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-xs text-muted-foreground">Correlation ID</p>
                <p className="font-mono text-sm truncate">{result.correlationId}</p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-xs text-muted-foreground">Processing Time</p>
                <p className="font-mono text-sm">{result.processingTimeMs}ms</p>
              </div>
              {result.signalType && (
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground">Signal Type</p>
                  <Badge variant="outline">{result.signalType}</Badge>
                </div>
              )}
              {result.error && (
                <div className="p-3 rounded-lg border bg-card border-red-500/20">
                  <p className="text-xs text-muted-foreground">Error</p>
                  <p className="text-sm text-red-500">{result.error}</p>
                </div>
              )}
            </div>

            {result.details && Object.keys(result.details).length > 0 && (
              <div className="space-y-2">
                <Label>Additional Details</Label>
                <Textarea
                  readOnly
                  value={JSON.stringify(result.details, null, 2)}
                  className="font-mono text-sm h-32"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Test Scenarios</CardTitle>
          <CardDescription>
            Common webhook scenarios for testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col"
              onClick={() => {
                setFormData({
                  symbol: 'MESRenko',
                  action: 'entry',
                  direction: 'long',
                  price: '5000.00',
                  quantity: '1',
                  isTest: true,
                });
              }}
            >
              <span className="text-green-500 font-medium">Long Entry</span>
              <span className="text-xs text-muted-foreground">Open long position</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 flex-col"
              onClick={() => {
                setFormData({
                  symbol: 'MESRenko',
                  action: 'entry',
                  direction: 'short',
                  price: '5000.00',
                  quantity: '1',
                  isTest: true,
                });
              }}
            >
              <span className="text-red-500 font-medium">Short Entry</span>
              <span className="text-xs text-muted-foreground">Open short position</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 flex-col"
              onClick={() => {
                setFormData({
                  symbol: 'MESRenko',
                  action: 'exit',
                  direction: 'long',
                  price: '5050.00',
                  quantity: '1',
                  isTest: true,
                });
              }}
            >
              <span className="text-blue-500 font-medium">Exit Long</span>
              <span className="text-xs text-muted-foreground">Close with profit</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 flex-col"
              onClick={() => {
                setFormData({
                  symbol: 'MESRenko',
                  action: 'exit',
                  direction: 'short',
                  price: '4950.00',
                  quantity: '1',
                  isTest: true,
                });
              }}
            >
              <span className="text-blue-500 font-medium">Exit Short</span>
              <span className="text-xs text-muted-foreground">Close with profit</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
