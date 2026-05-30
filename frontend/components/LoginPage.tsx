"use client";

import { Key, ShieldAlert, Sparkles } from "lucide-react";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: Readonly<LoginPageProps>) {
  return (
    <div className="relative min-h-dvh flex items-center justify-center p-4 overflow-hidden bg-[var(--surface-0)] select-none">
      {/* Premium ambient glows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(10,143,111,0.12),transparent_40%),radial-gradient(circle_at_75%_75%,rgba(56,197,154,0.14),transparent_35%)]" />

      {/* Spinning decorative orbit rings */}
      <div className="pointer-events-none absolute w-[500px] h-[500px] rounded-full border border-dashed border-[var(--accent-1)]/10 animate-[orbitSpin_40s_linear_infinite]" />
      <div className="pointer-events-none absolute w-[350px] h-[350px] rounded-full border border-dotted border-[var(--accent-2)]/15 animate-[orbitSpin_20s_linear_infinite_reverse]" />

      <div className="w-full max-w-md relative z-10 fade-in-up">
        {/* Glassmorphic card */}
        <div className="glass-panel border border-[var(--border-soft)]/50 rounded-3xl p-8 sm:p-10 shadow-2xl bg-[var(--surface-1)]/45 backdrop-blur-xl relative overflow-hidden flex flex-col items-center">
          {/* Top glow accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1.5 bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] rounded-b-full shadow-lg shadow-emerald-500/25" />

          {/* Icon Badge */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-[var(--accent-1)]/20 rounded-2xl blur-md" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] rounded-2xl flex items-center justify-center shadow-lg">
              <Key className="w-8 h-8 text-white stroke-[2]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--surface-1)] border border-[var(--border-soft)] flex items-center justify-center shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-2)]" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-1)]">
              Welcome to <span className="bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] bg-clip-text text-transparent">Aura AI</span>
            </h1>
            <p className="text-xs text-[var(--text-3)] mt-2 font-medium tracking-wide uppercase opacity-75">
              Secure Workspace Assistant
            </p>
          </div>

          {/* Security details checklist */}
          <div className="w-full space-y-3 mb-8 px-1">
            {[
              "Single Sign-On (SSO) with Keycloak",
              "Enterprise-grade security & encryption",
              "Contextual conversation history",
            ].map((text) => (
              <div key={text} className="flex items-center gap-2.5 text-xs text-[var(--text-2)] font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-1)] shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Main Keycloak Login Button */}
          <button
            onClick={onLogin}
            className="sweep-shine w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] hover:from-[var(--accent-2)] hover:to-[var(--accent-1)] text-white text-sm font-semibold transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2.5"
          >
            {/* Styled Keycloak Lock SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 icon-pop">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <span>Sign In with Keycloak</span>
          </button>

          {/* Footer note */}
          <div className="mt-8 flex items-center gap-1.5 text-[10px] text-[var(--text-3)] font-medium">
            <ShieldAlert className="w-3.5 h-3.5 opacity-80" />
            <span>Authorized credentials required to access this workspace.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
