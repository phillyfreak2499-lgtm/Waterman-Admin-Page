import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccess } from "@/components/access-provider";
import { useCatalog } from "@/components/catalog-provider";
import { isLeader } from "@/lib/access";
import { NotificationBell } from "@/components/notification-center";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

export function SiteHeader({ inverted = false }: { inverted?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  const { catalog } = useCatalog();
  const { access } = useAccess();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
  const tone = inverted ? "text-paper" : "text-navy";
  const ready = mounted && !isPending;
  const publicLinks: { to: string; label: string }[] = [
    { to: "/why", label: "Why" },
    { to: "/how-it-works", label: "How" },
    { to: "/training", label: "Training" },
    { to: "/directory", label: "Directory" },
    { to: "/quad", label: "The Quad" },
    { to: "/remarkable", label: "Be Remarkable" },
  ];
  const p = access.perms;
  const signedInLinks: { to: string; label: string }[] = [
    { to: "/locker", label: "My Locker" },
    { to: "/floor", label: "Floor" },
    ...(p.viewWhy ? [{ to: "/why", label: "Why" }] : []),
    ...(p.viewHow ? [{ to: "/how-it-works", label: "How" }] : []),
    ...(p.viewTraining ? [{ to: "/training", label: "Training" }] : []),
    ...(p.viewDirectory ? [{ to: "/directory", label: "Directory" }] : []),
    ...(p.viewQuad ? [{ to: "/quad", label: "The Quad" }] : []),
    ...(p.viewRemarkable ? [{ to: "/remarkable", label: "Be Remarkable" }] : []),
    ...(access.canManagePeople || p.viewTeam ? [{ to: "/team", label: "Team" }] : []),
    ...(isLeader(access.role) ? [{ to: "/metrics", label: "Team Metrics" }] : []),
    ...(access.isChancellor ? [{ to: "/chancellor", label: "Chancellor" }] : []),
    ...(access.canManageTraining ? [{ to: "/trainer", label: "Trainer" }] : []),
    ...(!access.isChancellor && (access.isAdmin || access.canSeeCompany)
      ? [{ to: "/admin", label: "Office" }]
      : []),
  ];
  const links = !ready || !user ? publicLinks : signedInLinks;

  function isActive(to: string) {
    if (to === "/") return pathname === "/";
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-md transition-colors",
        inverted
          ? "border-paper/15 bg-navy/95 supports-[backdrop-filter]:bg-navy/80"
          : "border-line bg-paper/95 supports-[backdrop-filter]:bg-paper/85",
      )}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div
        className={cn(
          "hidden border-b px-5 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] sm:block sm:px-8",
          inverted
            ? "border-paper/10 bg-navy-deep text-brass-soft"
            : "border-line bg-paper-2 text-muted",
        )}
      >
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4">
          <span>COGS · College of Getting Smarter</span>
          <span className="hidden md:inline">A private campus · Employees only</span>
        </div>
      </div>

      <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-4 px-5 sm:h-16 sm:px-8">
        <Link to="/" className={cn("flex shrink-0 items-center gap-1.5", tone)}>
          <img
            src={inverted ? "/media/waterman-logo-light.png" : "/media/waterman-logo.png"}
            alt="Waterman Arch Supports"
            className="h-4 w-auto shrink-0 object-contain object-left sm:h-5"
          />
          <img
            src="/media/seal.png"
            alt=""
            className="h-5 w-5 shrink-0 object-contain sm:h-5 sm:w-5"
          />
          <span className="font-display text-lg leading-none tracking-tight sm:text-xl">
            {catalog.site.short || "COGS"}
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden min-w-0 items-center gap-1 xl:flex 2xl:gap-2">
          {links.map((l) => {
            const active = isActive(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                {...(l.to === "/training" ? { search: {} } : {})}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative whitespace-nowrap px-2.5 py-2 text-[0.72rem] font-medium uppercase tracking-[0.1em] transition-colors 2xl:px-3 2xl:text-[0.75rem] 2xl:tracking-[0.12em]",
                  inverted
                    ? active
                      ? "text-brass-soft"
                      : "text-paper/75 hover:text-paper"
                    : active
                      ? "text-navy"
                      : "text-navy/65 hover:text-navy",
                )}
              >
                {l.label}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2.5 -bottom-0.5 h-px transition-opacity",
                    inverted ? "bg-brass-soft" : "bg-navy",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 whitespace-nowrap xl:flex">
          {ready && user ? (
            <div className={cn("flex items-center gap-1", inverted && "text-paper [&_button]:text-paper")}>
              <NotificationBell inverted={inverted} />
              <UserButton />
            </div>
          ) : ready && !user ? (
            <>
              <Link
                to="/register"
                className={cn(
                  "text-[0.75rem] font-medium uppercase tracking-[0.12em] transition-opacity hover:opacity-100",
                  inverted ? "text-paper/80" : "text-navy/70",
                )}
              >
                Create an account
              </Link>
              <Link
                to="/login"
                className={cn(
                  "inline-flex h-10 items-center rounded-sm px-4 text-sm font-medium transition-colors",
                  inverted
                    ? "bg-paper text-navy hover:bg-paper-2"
                    : "bg-navy text-paper hover:bg-navy-deep",
                )}
              >
                Sign in
              </Link>
            </>
          ) : (
            <div className="h-8 w-24 animate-pulse rounded-sm bg-navy/10" />
          )}
        </div>

        <button
          type="button"
          className={cn("grid h-11 w-11 place-items-center xl:hidden", tone)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div
          className={cn(
            "border-t px-5 py-5 xl:hidden",
            inverted ? "border-paper/15 bg-navy text-paper" : "border-line bg-paper text-navy",
          )}
        >
          <div className="flex flex-col gap-1">
            {links.map((l) => {
              const active = isActive(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  {...(l.to === "/training" ? { search: {} } : {})}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center text-sm font-medium",
                    active && (inverted ? "text-brass-soft" : "text-navy"),
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center text-sm font-medium"
            >
              Notifications
            </Link>
            <Link
              to="/install"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center text-sm font-medium"
            >
              Get the app
            </Link>
            {ready && user ? (
              <div className="pt-3">
                <UserButton />
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-sm border border-current text-sm font-medium"
                >
                  Create an account
                </Link>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center justify-center rounded-sm text-sm font-medium",
                    inverted ? "bg-paper text-navy" : "bg-navy text-paper",
                  )}
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
