"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { diffDays, formatDay, todayLocal } from "@/lib/dates";
import { BREAK_STAGE_LABEL, PHASE_LABEL } from "@/lib/rules";
import { useHydrated, useStore } from "@/lib/useStore";

const TABS = [
  { href: "/", label: "Today", icon: "M4 12h4l3-8 4 16 3-8h2" },
  { href: "/week", label: "Week", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/races", label: "Races", icon: "M5 21V4m0 0h11l-2 4 2 4H5" },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" },
];

export function Nav() {
  const path = usePathname();
  if (path.startsWith("/welcome")) return null;
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      {/* Phones and tablets: bottom tab bar */}
      <nav className="shrink-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto flex max-w-md md:max-w-2xl">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${active ? "text-accent" : "text-muted"}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon d={t.icon} />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: sidebar */}
      <nav className="hidden w-60 shrink-0 flex-col border-r border-line bg-card px-4 py-6 lg:order-first lg:flex" aria-label="Main">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-black tracking-tight text-accent-ink">RS</span>
          <span className="leading-tight">
            <span className="block text-sm font-bold">RunStrong Lift</span>
            <span className="block text-xs text-muted">Strength for runners</span>
          </span>
        </Link>
        <ul className="mt-8 space-y-1">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-accent-soft text-accent" : "text-muted hover:bg-card-2 hover:text-ink"
                  }`}
                >
                  <Icon d={t.icon} small />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <SidebarStatus />
      </nav>
    </>
  );
}

function Icon({ d, small }: { d: string; small?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={small ? "h-5 w-5" : "h-6 w-6"} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Next race and the current phase, at the bottom of the sidebar. */
function SidebarStatus() {
  const hydrated = useHydrated();
  const { races, settings } = useStore();
  if (!hydrated) return null;
  const today = todayLocal();
  const next = races.find((r) => r.date >= today);
  const days = next ? diffDays(today, next.date) : 0;
  return (
    <div className="mt-auto space-y-2">
      {next && (
        <Link href="/races" className="block rounded-xl bg-card-2 px-3 py-3 hover:ring-1 hover:ring-line">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-accent">Next race</span>
          <span className="mt-0.5 block truncate text-sm font-semibold">{next.name}</span>
          <span className="block text-xs text-muted">
            {formatDay(next.date)} · {days === 0 ? "today" : days === 1 ? "tomorrow" : `${days} days`}
          </span>
        </Link>
      )}
      <Link href="/settings" className="block px-3 text-xs text-muted hover:text-ink">
        {settings.breakStage !== "normal" ? BREAK_STAGE_LABEL[settings.breakStage] : PHASE_LABEL[settings.phase]}
      </Link>
    </div>
  );
}
