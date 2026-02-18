import { useState } from "react";
import { Mail, Check, AlertCircle } from "lucide-react";
import { trpc } from "../lib/trpc";

type SubmissionStatus = "idle" | "loading" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [message, setMessage] = useState("");

  // @ts-expect-error TS2339
  const addToWaitlistMutation = trpc.waitlist.addToWaitlist.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setStatus("error");
      setMessage("Please enter your email address");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const result = await addToWaitlistMutation.mutateAsync({ email });

      if (result.success) {
        setStatus("success");
        setMessage(result.message);
        setEmail("");

        // Reset success message after 5 seconds
        setTimeout(() => {
          setStatus("idle");
          setMessage("");
        }, 5000);
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to join waitlist"
      );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={status === "loading"}
              className="w-full pl-10 pr-4 py-2.5 bg-background/50 border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {status === "loading" ? "Joining..." : "Join Waitlist"}
          </button>
        </div>

        {/* Status Messages */}
        {status === "success" && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-400">{message}</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-400">{message}</p>
          </div>
        )}
      </form>

      <p className="text-xs text-muted-foreground text-center mt-3">
        We'll notify you when early access is available. No spam, ever.
      </p>
    </div>
  );
}
