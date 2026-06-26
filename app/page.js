"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { SPORT_FILTERS, TYPE_FILTERS, EVENTS_PER_PAGE } from "@/lib/constants";
import MapView from "@/components/MapView";
import EventCard from "@/components/EventCard";
import { hasValidCoords } from "@/lib/helpers";

export default function HomePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("Toate");
  const [type, setType] = useState("Toate");
  const [page, setPage] = useState(1);
  const [joinBusyId, setJoinBusyId] = useState(null);

  const flyToRef = useRef(null);
  const mapSectionRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: evs } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });
      const eventList = evs || [];
      const ids = eventList.map((e) => e.id);

      const counts = {};
      const joinedSet = new Set();
      if (ids.length) {
        const { data: parts } = await supabase
          .from("event_participants")
          .select("event_id,user_id")
          .in("event_id", ids);
        (parts || []).forEach((p) => {
          counts[p.event_id] = (counts[p.event_id] || 0) + 1;
          if (user && p.user_id === user.id) joinedSet.add(p.event_id);
        });
      }

      if (!active) return;
      setEvents(
        eventList.map((e) => ({
          ...e,
          count: counts[e.id] ?? 0,
          joined: joinedSet.has(e.id),
        }))
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (sport !== "Toate" && (e.sport || "").toLowerCase() !== sport.toLowerCase())
        return false;
      if (type !== "Toate" && (e.type || "").toLowerCase() !== type.toLowerCase())
        return false;
      if (q) {
        const hay = `${e.sport || ""} ${e.location || ""} ${e.title || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, search, sport, type]);

  useEffect(() => {
    setPage(1);
  }, [search, sport, type]);

  // Let the chatbot's "Vezi pe hartă" buttons fly the map to an event — both
  // when already on this page (custom event) and after navigating here from
  // another page (target stashed in sessionStorage). Retries until the map is
  // mounted and its flyTo handler is ready.
  useEffect(() => {
    const doFly = (ev, tries = 0) => {
      if (!ev) return;
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (flyToRef.current) {
        setTimeout(() => flyToRef.current(ev), 250);
      } else if (tries < 12) {
        setTimeout(() => doFly(ev, tries + 1), 300);
      }
    };
    const onFly = () => {
      const ev = window.__pickupFlyEvent;
      window.__pickupFlyEvent = null;
      doFly(ev);
    };
    window.addEventListener("pickup:fly-to-event", onFly);
    let pending = null;
    try {
      pending = sessionStorage.getItem("pickup:fly");
    } catch {}
    if (pending) {
      try {
        sessionStorage.removeItem("pickup:fly");
        doFly(JSON.parse(pending));
      } catch {}
    }
    return () => window.removeEventListener("pickup:fly-to-event", onFly);
  }, []);

  const totalCount = events.length;
  const casualCount = events.filter((e) => e.type === "casual").length;
  const officialCount = events.filter((e) => e.type === "official").length;
  const mapCount = filtered.filter(hasValidCoords).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / EVENTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * EVENTS_PER_PAGE,
    safePage * EVENTS_PER_PAGE
  );

  // Windowed page list so the control stays compact (and Prev/Next stay on
  // screen) no matter how many pages there are: first, last, current ±1, with
  // "…" markers for the gaps. Below 8 pages we just show them all.
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const wanted = [1, totalPages, safePage - 1, safePage, safePage + 1];
    const shown = [...new Set(wanted)]
      .filter((n) => n >= 1 && n <= totalPages)
      .sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const n of shown) {
      if (n - prev > 1) out.push(`gap-${n}`);
      out.push(n);
      prev = n;
    }
    return out;
  }, [totalPages, safePage]);

  const handleMapClick = (event) => {
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // slight delay so the map is in view before the camera animates
    setTimeout(() => flyToRef.current?.(event), 200);
  };

  const handleToggleJoin = async (event, join) => {
    if (!user) return;
    setJoinBusyId(event.id);
    if (join) {
      const { error } = await supabase
        .from("event_participants")
        .insert({ event_id: event.id, user_id: user.id });
      if (!error)
        setEvents((es) =>
          es.map((e) =>
            e.id === event.id ? { ...e, joined: true, count: e.count + 1 } : e
          )
        );
    } else {
      const { error } = await supabase
        .from("event_participants")
        .delete()
        .eq("event_id", event.id)
        .eq("user_id", user.id);
      if (!error)
        setEvents((es) =>
          es.map((e) =>
            e.id === event.id
              ? { ...e, joined: false, count: Math.max(0, e.count - 1) }
              : e
          )
        );
    }
    setJoinBusyId(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      {/* ---------- Hero ---------- */}
      <section className="py-12 sm:py-16">
        <div className="mono mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
          <span className="live-dot" aria-hidden />
          Timișoara · Live now
        </div>
        <h1 className="text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
          FIND YOUR
          <br />
          <span className="text-outline">NEXT GAME</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
          Discover pickup games happening around the city, join casual matches,
          and register for official events — all on one map.
        </p>

        {/* Live count badges */}
        <div className="mt-7 flex flex-wrap gap-3">
          <StatBadge label="Total events" value={totalCount} dot="#f0f6ff" />
          <StatBadge label="Casual" value={casualCount} dot="#16a34a" />
          <StatBadge label="Official" value={officialCount} dot="#f97316" />
        </div>
      </section>

      {/* ---------- Map ---------- */}
      <section ref={mapSectionRef} className="scroll-mt-20">
        <div className="relative overflow-hidden rounded-2xl border border-line">
          <MapView
            events={filtered}
            flyToRef={flyToRef}
            className="h-[380px] w-full sm:h-[460px]"
          />
        </div>
        <div className="mono mt-2 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            Casual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange" />
            Official
          </span>
          <span className="ml-auto">
            {mapCount} event{mapCount === 1 ? "" : "s"} shown on map
          </span>
        </div>
      </section>

      {/* ---------- Controls ---------- */}
      <section className="mt-10">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by sport or location…"
            className="field-input pl-10"
          />
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {SPORT_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setSport(s)}
                className={`pill ${sport === s ? "pill-active" : ""}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`pill ${type === t ? "pill-active" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Event grid ---------- */}
      <section className="mt-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-[0.875rem] border border-line bg-card"
              />
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <div className="card flex flex-col items-center justify-center gap-2 p-12 text-center">
            <p className="text-lg font-medium">No events found</p>
            <p className="text-sm text-muted">
              Try a different sport, type, or search term.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {pageItems.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                count={e.count}
                joined={e.joined}
                isLoggedIn={!!user}
                busy={joinBusyId === e.id}
                onMapClick={handleMapClick}
                onToggleJoin={handleToggleJoin}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="btn btn-muted shrink-0"
            >
              ← Prev
            </button>
            {pageNumbers.map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  onClick={() => setPage(item)}
                  className={`pill shrink-0 ${
                    safePage === item ? "pill-active" : ""
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span
                  key={item}
                  className="mono px-1 text-muted select-none"
                  aria-hidden
                >
                  …
                </span>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="btn btn-muted shrink-0"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function StatBadge({ label, value, dot }) {
  return (
    <div className="card flex items-center gap-3 px-4 py-2.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: dot }}
      />
      <div className="flex items-baseline gap-2">
        <span className="mono text-xl font-medium text-fg">{value}</span>
        <span className="mono text-[0.7rem] uppercase tracking-wider text-muted">
          {label}
        </span>
      </div>
    </div>
  );
}
