"use client";

import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { formatDate, formatTime, hasValidCoords } from "@/lib/helpers";
import ProgressBar from "./ProgressBar";

export default function EventCard({
  event,
  count = 0,
  joined = false,
  onToggleJoin,
  onMapClick,
  isLoggedIn = false,
  busy = false,
}) {
  const isOfficial = event.type === "official";
  const max = event.max_players ?? 0;
  const full = max > 0 && count >= max && !joined;

  const renderActionButton = () => {
    // Official events with an external registration link
    if (isOfficial && event.source_url) {
      return (
        <a
          href={event.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary flex-1"
        >
          Register
          <ExternalLink size={15} aria-hidden />
        </a>
      );
    }
    if (!isLoggedIn) {
      return (
        <a href="/login" className="btn btn-outline flex-1">
          {isOfficial ? "Register" : "Join"}
        </a>
      );
    }
    if (joined) {
      return (
        <button
          onClick={() => onToggleJoin?.(event, false)}
          disabled={busy}
          className="btn btn-muted flex-1"
        >
          {busy ? "…" : "Leave"}
        </button>
      );
    }
    return (
      <button
        onClick={() => onToggleJoin?.(event, true)}
        disabled={busy || full}
        className="btn btn-primary flex-1"
      >
        {busy ? "…" : full ? "Full" : isOfficial ? "Register" : "Join"}
      </button>
    );
  };

  return (
    <div className="card card-hover flex flex-col gap-3 p-5">
      {/* Badges */}
      <div className="flex items-center gap-2">
        {event.sport && <span className="badge badge-sport">{event.sport}</span>}
        <span className={`badge ${isOfficial ? "badge-official" : "badge-casual"}`}>
          {isOfficial ? "Official" : "Casual"}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium leading-snug text-fg">{event.title}</h3>

      {/* Meta */}
      <div className="mono flex flex-col gap-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Calendar size={13} className="shrink-0 text-muted" aria-hidden />
          {formatDate(event.date)}
          {event.time && <> · {formatTime(event.time)}</>}
        </span>
        {event.location && (
          <span className="flex items-center gap-1.5">
            <MapPin size={13} className="shrink-0 text-muted" aria-hidden />
            <span className="truncate">{event.location}</span>
          </span>
        )}
      </div>

      {/* Players progress */}
      <div className="mt-1 flex flex-col gap-1.5">
        <div className="mono flex items-center justify-between text-xs">
          <span className="text-muted">Players</span>
          <span className="text-fg">
            {count}
            {max ? ` / ${max}` : ""}
          </span>
        </div>
        <ProgressBar value={count} max={max} />
      </div>

      {/* Actions */}
      <div className="mt-2 flex items-center gap-2">
        {hasValidCoords(event) && (
          <button
            onClick={() => onMapClick?.(event)}
            className="btn btn-outline flex-1"
          >
            <MapPin size={15} aria-hidden />
            Map
          </button>
        )}
        {renderActionButton()}
      </div>
    </div>
  );
}
