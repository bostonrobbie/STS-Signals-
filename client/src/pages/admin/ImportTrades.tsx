/**
 * /admin/import — CSV trade upload UI (admin only).
 *
 * Wraps the existing trpc.webhook.uploadTrades admin mutation in a
 * browser form. Accepts a pasted CSV OR a file upload. Parses client-side
 * with a minimal BOM-aware CSV parser (no new deps). Supports the
 * TradingView "List of Trades" export format used for the 15-year
 * backtest import.
 *
 * Flow:
 *   1. Pick strategy (defaults to NQTrend)
 *   2. Paste CSV or upload .csv file
 *   3. Preview parsed row count + first 5 rows
 *   4. Decide overwrite vs append
 *   5. Submit → tRPC uploads in one batch
 *   6. Show result (inserted / skipped)
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
} from "lucide-react";

interface ParsedTrade {
  entryDate: string;
  exitDate: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  commission: number;
}

// ── TradingView "List of Trades" CSV parser ────────────────────────────
// Same format used by scripts/import-csv-trades.mts for the 15-year backtest.
// Each trade = 2 rows (entry + exit) sharing the Trade # column.
function parseTvCsv(raw: string): { trades: ParsedTrade[]; warnings: string[] } {
  // Strip UTF-8 BOM if present
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 3) {
    return { trades: [], warnings: ["CSV has fewer than 3 lines — nothing to parse"] };
  }

  const headers = splitCsvRow(lines[0]).map(h => h.trim());
  const idx = (name: string) =>
    headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const iTradeNum = idx("Trade #");
  const iType = idx("Type");
  const iDate = idx("Date and time");
  const iPrice = idx("Price USD");
  const iQty = idx("Size (qty)");
  const iPnl = idx("Net P&L USD");

  if (
    iTradeNum < 0 ||
    iType < 0 ||
    iDate < 0 ||
    iPrice < 0 ||
    iPnl < 0
  ) {
    return {
      trades: [],
      warnings: [
        `Missing required columns. Found: ${headers.join(", ")}`,
        "Expected TradingView 'List of Trades' format with: Trade #, Type, Date and time, Price USD, Size (qty), Net P&L USD",
      ],
    };
  }

  // Group by Trade #
  type RawRow = { num: number; type: string; date: string; price: number; qty: number; pnl: number };
  const groups = new Map<number, RawRow[]>();
  for (let li = 1; li < lines.length; li++) {
    const c = splitCsvRow(lines[li]);
    const num = parseInt(c[iTradeNum] ?? "", 10);
    if (!Number.isFinite(num)) continue;
    const row: RawRow = {
      num,
      type: (c[iType] ?? "").trim(),
      date: (c[iDate] ?? "").trim(),
      price: parseFloat(c[iPrice] ?? "0"),
      qty: parseInt(c[iQty] ?? "1", 10) || 1,
      pnl: parseFloat(c[iPnl] ?? "0"),
    };
    if (!groups.has(num)) groups.set(num, []);
    groups.get(num)!.push(row);
  }

  const warnings: string[] = [];
  const trades: ParsedTrade[] = [];
  let skipped = 0;
  for (const [num, pair] of groups) {
    const entry = pair.find(p => p.type.startsWith("Entry"));
    const exit = pair.find(p => p.type.startsWith("Exit"));
    if (!entry || !exit) {
      skipped++;
      continue;
    }
    trades.push({
      entryDate: entry.date + ":00",
      exitDate: exit.date + ":00",
      direction: entry.type.includes("long") ? "long" : "short",
      entryPrice: entry.price,
      exitPrice: exit.price,
      quantity: entry.qty,
      pnl: exit.pnl,
      commission: 0,
    });
  }
  if (skipped > 0) {
    warnings.push(
      `${skipped} trade number(s) had only one row (missing entry or exit) and were skipped`
    );
  }
  warnings.push(
    `Parsed ${trades.length} trades from ${lines.length - 1} CSV rows`
  );
  return { trades, warnings };
}

function splitCsvRow(line: string): string[] {
  // Minimal CSV splitter — handles quoted fields with commas.
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export default function ImportTrades() {
  const [csv, setCsv] = useState("");
  const [strategySymbol, setStrategySymbol] = useState("NQTrend");
  const [overwrite, setOverwrite] = useState(false);
  const [parsed, setParsed] = useState<ParsedTrade[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<{
    inserted?: number;
    error?: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const strategies = trpc.publicApi.listStrategies.useQuery();
  const uploadMutation = trpc.webhook.uploadTrades.useMutation();

  const strategyId = strategies.data?.find(
    s => s.symbol.toLowerCase() === strategySymbol.toLowerCase()
  )?.id;

  function handleParse() {
    const { trades, warnings } = parseTvCsv(csv);
    setParsed(trades);
    setWarnings(warnings);
    setResult(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsv((reader.result as string) || "");
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!parsed || !strategyId) return;
    setResult(null);
    try {
      const res = await uploadMutation.mutateAsync({
        strategyId,
        trades: parsed,
        overwrite,
      });
      setResult({ inserted: (res as any).inserted ?? parsed.length });
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  function handleClear() {
    setCsv("");
    setParsed(null);
    setWarnings([]);
    setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Import Trades (Admin) — STS Futures"
        description="Admin utility for uploading TradingView List-of-Trades CSV exports to the trades table."
        canonical="https://stsdashboard.com/admin/import"
        noindex
      />

      <main className="container max-w-4xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Import trades</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Paste a TradingView &quot;List of Trades&quot; CSV or upload the
            file. Parses client-side; one batch insert via the admin
            uploadTrades mutation.
          </p>
        </header>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">1. Target strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="sym" className="text-xs text-muted-foreground">
              Strategy symbol
            </Label>
            <Input
              id="sym"
              value={strategySymbol}
              onChange={e => setStrategySymbol(e.target.value)}
              placeholder="NQTrend"
              className="max-w-sm"
            />
            {strategies.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading strategies…</p>
            ) : strategyId ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ Resolved to strategy id {strategyId}
              </p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Strategy &quot;{strategySymbol}&quot; not found. Create it
                first or correct the symbol.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              2. CSV source
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-muted file:text-foreground file:cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">or paste below</span>
            </div>
            <Textarea
              value={csv}
              onChange={e => setCsv(e.target.value)}
              placeholder="Trade #,Type,Date and time,Signal,Price USD,Size (qty),Size (value),Net P&L USD,..."
              rows={8}
              className="font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleParse}
                disabled={csv.trim().length === 0}
              >
                Parse CSV
              </Button>
              <Button size="sm" variant="outline" onClick={handleClear}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            </div>
            {warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  <ul className="list-disc list-inside space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {parsed && parsed.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">
                3. Preview ({parsed.length.toLocaleString()} trades parsed)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b text-muted-foreground">
                      <th className="py-1.5 pr-3">Entry</th>
                      <th className="py-1.5 pr-3">Exit</th>
                      <th className="py-1.5 pr-3">Dir</th>
                      <th className="py-1.5 pr-3 text-right">Entry $</th>
                      <th className="py-1.5 pr-3 text-right">Exit $</th>
                      <th className="py-1.5 pr-3 text-right">Qty</th>
                      <th className="py-1.5 text-right">P&amp;L $</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {parsed.slice(0, 5).map((t, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1 pr-3">{t.entryDate}</td>
                        <td className="py-1 pr-3">{t.exitDate}</td>
                        <td className="py-1 pr-3">{t.direction}</td>
                        <td className="py-1 pr-3 text-right">{t.entryPrice.toFixed(2)}</td>
                        <td className="py-1 pr-3 text-right">{t.exitPrice.toFixed(2)}</td>
                        <td className="py-1 pr-3 text-right">{t.quantity}</td>
                        <td
                          className={`py-1 text-right ${
                            t.pnl > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : t.pnl < 0
                                ? "text-red-600"
                                : ""
                          }`}
                        >
                          {t.pnl > 0 ? "+" : ""}
                          {t.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground mt-2">
                  Showing first 5 of {parsed.length.toLocaleString()}. Total
                  net P&amp;L ={" "}
                  <span className="font-mono font-semibold">
                    ${parsed.reduce((s, t) => s + t.pnl, 0).toLocaleString()}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t">
                <Switch
                  checked={overwrite}
                  onCheckedChange={setOverwrite}
                  id="overwrite"
                />
                <Label htmlFor="overwrite" className="text-sm cursor-pointer">
                  Overwrite existing trades for this strategy
                  <span className="block text-xs text-muted-foreground font-normal">
                    Off = append; On = delete existing then insert these.
                  </span>
                </Label>
              </div>
            </CardContent>
          </Card>
        )}

        {parsed && parsed.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" />
                4. Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleUpload}
                disabled={
                  uploadMutation.isPending ||
                  !strategyId ||
                  parsed.length === 0
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadMutation.isPending
                  ? "Uploading…"
                  : `Upload ${parsed.length.toLocaleString()} trades`}
              </Button>

              {result?.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}

              {result?.inserted != null && !result.error && (
                <Alert>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <AlertDescription>
                    Successfully uploaded{" "}
                    <strong>{result.inserted.toLocaleString()}</strong> trades.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-[11px] text-muted-foreground">
          CSV format reference: docs/TRADE_CSV_FORMAT.md
        </p>
      </main>
    </div>
  );
}
