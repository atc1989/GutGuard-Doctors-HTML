"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { adminLogin } from "@/lib/api";

export default function AdminLogin({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoggingIn(true);
    setError(null);
    try {
      await adminLogin(password);
      setPassword("");
      await onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That password didn't work. Try again.");
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-chrome px-4 py-10 font-sans text-foreground antialiased">
      <div className="flex w-full max-w-[360px] flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <Image src="/gutguard-logo.png" alt="" width={20} height={24} priority />
          <span className="text-[15px] font-medium tracking-[-0.01em]">GutGuard</span>
        </div>

        <div className="rounded-xl border border-border bg-background p-6 shadow-lift">
          <h1 className="m-0 max-w-none font-sans text-base font-medium leading-6 tracking-normal text-foreground">Sign in to admin</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Use your owner or staff password.</p>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loggingIn}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "admin-login-error" : undefined}
                autoFocus
                required
              />
              {error && (
                <p id="admin-login-error" role="alert" className="text-[13px] text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loggingIn || !password.trim()}>
              {loggingIn ? (
                <>
                  <LoaderCircle className="animate-spin" strokeWidth={1.5} aria-hidden="true" />
                  Signing in
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">Sessions end after 8 hours.</p>
      </div>
    </div>
  );
}
