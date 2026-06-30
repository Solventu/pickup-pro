"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Search, ChevronLeft, ChevronRight, Map } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { SPORT_FILTERS, TYPE_FILTERS, EVENTS_PER_PAGE } from "@/lib/constants";
import MapView from "@/components/MapView";
import EventCard from "@/components/EventCard";
import { hasValidCoords } from "@/lib/helpers";

// Shared entrance motion. `stagger` reveals children one after another; `rise`
// is a soft fade-up for each item. MotionConfig (in SmoothScroll) already
// disables all of this when the user prefers reduced motion.
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export default function HomePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("All");
  const [type, setType] = useState("All");
  const [page, setPage] = useState(1);
  const [joinBusyId, setJoinBusyId] = useState(null);
  const [showMap, setShowMap] = useState(false);

  const flyToRef = useRef(null);
  const mapSectionRef = useRef(null);

  // Fetch every event in the database (worldwide) plus participant counts. Kept
  // in a callback so the realtime subscription can re-run it on any change.
  const fetchEvents = useCallback(async () => {
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

    setEvents(
      eventList.map((e) => ({
        ...e,
        count: counts[e.id] ?? 0,
        joined: joinedSet.has(e.id),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchEvents().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchEvents]);

  // Realtime: keep the map and list live as events are inserted, updated, or
  // removed anywhere — no manual refresh. Cleaned up on unmount.
  useEffect(() => {
    const channel = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => fetchEvents()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (sport !== "All" && (e.sport || "").toLowerCase() !== sport.toLowerCase())
        return false;
      if (type !== "All" && (e.type || "").toLowerCase() !== type.toLowerCase())
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

  // Reveal the map (if hidden), scroll to it, and fly to an event. Retries until
  // MapView has mounted and exposed its flyTo handler. Shared by event-card "Map"
  // buttons and the chatbot's "See on map" actions.
  const flyToEvent = useCallback((ev, tries = 0) => {
    if (!ev) return;
    setShowMap(true);
    if (tries === 0) {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (flyToRef.current) {
      setTimeout(() => flyToRef.current(ev), 250);
    } else if (tries < 16) {
      setTimeout(() => flyToEvent(ev, tries + 1), 300);
    }
  }, []);

  // Let the chatbot's "See on map" buttons fly the map to an event — both when
  // already on this page (custom event) and after navigating here from another
  // page (target stashed in sessionStorage).
  useEffect(() => {
    const onFly = () => {
      const ev = window.__pickupFlyEvent;
      window.__pickupFlyEvent = null;
      flyToEvent(ev);
    };
    window.addEventListener("pickup:fly-to-event", onFly);
    let pending = null;
    try {
      pending = sessionStorage.getItem("pickup:fly");
    } catch {}
    if (pending) {
      try {
        sessionStorage.removeItem("pickup:fly");
        flyToEvent(JSON.parse(pending));
      } catch {}
    }
    return () => window.removeEventListener("pickup:fly-to-event", onFly);
  }, [flyToEvent]);

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

  const handleMapClick = (event) => flyToEvent(event);

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
      <section className="py-6 sm:py-8">
        <motion.div
          className="relative overflow-hidden rounded-2xl border border-line"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {/* Cinematic background */}
          <HeroVideo />

          {/* Scrim — keeps the headline legible over the footage. Heavy on the
              left (where the text sits), lighter on the right (where the action
              shows through), plus a bottom fade for the stat badges. */}
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                "linear-gradient(90deg, rgba(26,27,38,0.94) 0%, rgba(26,27,38,0.78) 42%, rgba(26,27,38,0.3) 72%, rgba(26,27,38,0.55) 100%), linear-gradient(0deg, rgba(26,27,38,0.9) 0%, rgba(26,27,38,0) 48%)",
            }}
          />

          {/* Content */}
          <div className="relative z-[2] flex min-h-[clamp(240px,40vw,540px)] flex-col justify-center px-[clamp(1.5rem,5vw,3rem)] py-[clamp(1.75rem,5vw,3rem)]">
            <motion.div
              variants={rise}
              className="mono mb-[clamp(0.625rem,2vw,1rem)] flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent"
            >
              <span className="live-dot" aria-hidden />
              Worldwide · Live now
            </motion.div>
            <motion.h1
              variants={rise}
              className="text-[clamp(2.25rem,8vw,4.5rem)] font-bold leading-[0.95] tracking-tight"
            >
              FIND YOUR
              <br />
              <span className="text-outline">NEXT GAME</span>
            </motion.h1>
            <motion.p
              variants={rise}
              className="mt-[clamp(0.75rem,2vw,1.25rem)] max-w-xl text-[clamp(0.875rem,1.6vw,1.125rem)] text-muted"
            >
              Discover pickup games happening around the city, join casual
              matches, and register for official events — all on one map.
            </motion.p>

            {/* Live count badges */}
            <motion.div variants={rise} className="mt-[clamp(1.25rem,3vw,1.75rem)] flex flex-wrap gap-3">
              <StatBadge label="Total events" value={totalCount} dot="#e8e8f2" />
              <StatBadge label="Casual" value={casualCount} dot="#22c55e" />
              <StatBadge label="Official" value={officialCount} dot="#fb923c" />
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ---------- Map (hidden until toggled) ---------- */}
      <section ref={mapSectionRef} className="scroll-mt-20">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Live map</SectionLabel>
          <button
            onClick={() => setShowMap((v) => !v)}
            aria-expanded={showMap}
            className="btn btn-muted"
          >
            <Map size={15} aria-hidden />
            {showMap ? "Hide map" : "Show map"}
          </button>
        </div>

        {showMap && (
          <>
            {/* data-lenis-prevent: stop the smooth-scroll wrapper from hijacking
                the wheel over the map, so scrolling there zooms the map instead
                of scrolling the page. */}
            <div
              data-lenis-prevent
              className="relative overflow-hidden rounded-2xl border border-line"
            >
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
          </>
        )}
      </section>

      {/* ---------- Controls ---------- */}
      <section className="mt-10">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <Search size={16} aria-hidden />
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
        <SectionLabel>Upcoming games</SectionLabel>
        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="skeleton h-56 rounded-[0.875rem] border border-line"
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
          <motion.div
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            key={`${safePage}-${sport}-${type}-${search}`}
          >
            {pageItems.map((e) => (
              <motion.div
                key={e.id}
                variants={rise}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 350, damping: 24 }}
              >
                <EventCard
                  event={e}
                  count={e.count}
                  joined={e.joined}
                  isLoggedIn={!!user}
                  busy={joinBusyId === e.id}
                  onMapClick={handleMapClick}
                  onToggleJoin={handleToggleJoin}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="btn btn-muted shrink-0"
            >
              <ChevronLeft size={15} aria-hidden />
              Prev
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
              Next
              <ChevronRight size={15} aria-hidden />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// Small mono eyebrow that labels a section with a short accent rule — gives the
// page editorial rhythm instead of stacked unlabelled blocks. Fades in on scroll.
function SectionLabel({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mono mb-3 flex items-center gap-2.5 text-xs uppercase tracking-[0.2em] text-muted"
    >
      <span className="h-px w-7 bg-accent/70" aria-hidden />
      {children}
    </motion.div>
  );
}

// Hero background video. Plays muted/looping for the cinematic look, but honours
// "reduce motion" by falling back to the poster still. aria-hidden + no audio so
// it's purely decorative and never traps focus or makes noise.
function HeroVideo() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (reduced) {
    return (
      <img
        src="/hero-poster.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <video
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      poster="/hero-poster.jpg"
      aria-hidden
    >
      <source src="/hero.webm" type="video/webm" />
      <source src="/hero.mp4" type="video/mp4" />
    </video>
  );
}

function StatBadge({ label, value, dot }) {
  // Count up from 0 to `value` whenever the number changes. The motion value
  // drives a rounded text node so the badge animates without re-rendering the
  // whole card; reduced-motion users get an instant set via the short tween.
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
    });
    return controls.stop;
  }, [value, count]);

  return (
    <motion.div
      className="card flex items-center gap-3 px-4 py-2.5"
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: dot }}
      />
      <div className="flex items-baseline gap-2">
        <motion.span className="mono text-xl font-medium text-fg">
          {rounded}
        </motion.span>
        <span className="mono text-[0.7rem] uppercase tracking-wider text-muted">
          {label}
        </span>
      </div>
    </motion.div>
  );
}
