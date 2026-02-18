import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import {
  TrendingUp,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token") || "";

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setIsSuccess(true);
      setError("");
      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation("/password-login");
      }, 3000);
    },
    onError: err => {
      setError(
        err.message || "Failed to reset password. The link may have expired."
      );
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter a new password");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
      return;
    }

    resetPassword.mutate({ token, newPassword: password });
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTEgMGExIDEgMCAxIDAgMiAwYTEgMSAwIDEgMCAtMiAwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9nPjwvc3ZnPg==')] opacity-40" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-2xl font-bold text-white"
          >
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </div>
            <span>STS</span>
            <span className="text-emerald-500 text-sm font-normal">
              FUTURES
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-border p-8 shadow-2xl">
          {!isSuccess ? (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4">
                  <Lock className="h-8 w-8 text-emerald-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Set New Password
                </h1>
                <p className="text-muted-foreground">
                  Enter your new password below
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-[#0a0f1a] border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-300"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Must be at least 8 characters
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-[#0a0f1a] border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetPassword.isPending}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {resetPassword.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Password Reset!
              </h2>
              <p className="text-muted-foreground mb-4">
                Your password has been successfully reset.
              </p>
              <p className="text-muted-foreground text-sm">
                Redirecting to login...
              </p>
            </div>
          )}

          {/* Back to Login */}
          {!isSuccess && (
            <div className="mt-6 pt-6 border-t border-border text-center">
              <Link
                href="/password-login"
                className="text-muted-foreground hover:text-white transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
