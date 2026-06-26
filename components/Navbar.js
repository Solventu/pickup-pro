"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import NotificationBell from "./NotificationBell";
import UserSearch from "./UserSearch";

function NavLink({ href, active, children, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`text-sm font-medium transition-colors ${
        active ? "text-accent" : "text-muted hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  };

  const profileHref = user ? `/athletes/${user.id}` : "/login";
  const username = profile?.username || "profile";
  const isActive = (href) => pathname === href;

  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo + LIVE dot */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="live-dot" aria-hidden />
          <span className="text-lg font-bold tracking-tight">
            PICKUP<span className="text-accent">PRO</span>
          </span>
          <span className="mono hidden text-[0.6rem] uppercase tracking-widest text-muted sm:inline">
            live
          </span>
        </Link>

        {/* Desktop center links */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex">
          <NavLink href="/feed" active={isActive("/feed")}>
            Feed
          </NavLink>
          <NavLink href={profileHref} active={pathname.startsWith("/athletes")}>
            Profile
          </NavLink>
          {isAdmin && (
            <NavLink href="/post-event" active={isActive("/post-event")}>
              Admin
            </NavLink>
          )}
        </div>

        {/* Desktop right actions */}
        <div className="hidden items-center gap-3 lg:flex">
          <UserSearch />
          {user ? (
            <>
              <NotificationBell />
              <Link href="/feed" className="btn btn-primary">
                + Post
              </Link>
              <Link
                href={profileHref}
                className="mono max-w-[10rem] truncate text-sm text-fg hover:text-accent"
              >
                @{username}
              </Link>
              <button onClick={handleLogout} className="btn btn-muted">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-muted">
                Login
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-1 lg:hidden">
          <UserSearch />
          <NotificationBell />
          <button
            ref={btnRef}
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-fg"
          >
          <div className="flex flex-col items-center justify-center gap-[5px]">
            <span
              className={`block h-0.5 w-5 bg-current transition-transform ${
                open ? "translate-y-[7px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-opacity ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-transform ${
                open ? "-translate-y-[7px] -rotate-45" : ""
              }`}
            />
          </div>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div
          ref={menuRef}
          className="border-t border-line bg-card lg:hidden"
        >
          <div className="flex flex-col gap-1 px-4 py-3">
            <Link
              href="/feed"
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive("/feed") ? "bg-accent/10 text-accent" : "text-fg"
              }`}
            >
              Feed
            </Link>
            <Link
              href={profileHref}
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                pathname.startsWith("/athletes") ? "bg-accent/10 text-accent" : "text-fg"
              }`}
            >
              Profile
            </Link>
            {isAdmin && (
              <Link
                href="/post-event"
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive("/post-event") ? "bg-accent/10 text-accent" : "text-fg"
                }`}
              >
                Admin · Post Event
              </Link>
            )}

            <div className="my-2 h-px bg-line" />

            {user ? (
              <>
                <Link
                  href="/feed"
                  onClick={() => setOpen(false)}
                  className="btn btn-primary w-full"
                >
                  + Post
                </Link>
                <div className="mono px-3 py-2 text-sm text-muted">
                  Signed in as{" "}
                  <span className="text-fg">@{username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn btn-muted w-full"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="btn btn-muted flex-1"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="btn btn-primary flex-1"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
