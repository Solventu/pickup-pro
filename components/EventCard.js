"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { formatDate, formatTime, hasValidCoords } from "@/lib/helpers";
import ProgressBar from "./ProgressBar";
import EventParticipantsModal from "./EventParticipantsModal";

export default function EventCard({
  event,
  count = 0,
  joined = false,
  onToggleJoin,
  onMapClick,
  isLoggedIn = false,
  busy = false,
  currentUser = null,
}) {
  const isOfficial = event.type === "official";
  const max = event.max_players ?? 0;
  const full = max > 0 && count >= max && !joined;
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const going = event.participants_followed || [];

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
    <div className="card card-hover flex h-full flex-col gap-3 p-5">
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

      {/* Players progress — count opens the full participant list. */}
      <div className="mt-1 flex flex-col gap-1.5">
        <div className="mono flex items-center justify-between text-xs">
          <span className="text-muted">Players</span>
          <button
            onClick={() => count > 0 && setParticipantsOpen(true)}
            disabled={count === 0}
            className={
              count > 0 ? "text-fg hover:text-accent hover:underline" : "text-fg"
            }
          >
            {count}
            {max ? ` / ${max}` : ""}
          </button>
        </div>
        <ProgressBar value={count} max={max} />
      </div>

      {/* "Going" — accounts you follow who joined this event. */}
      {going.length > 0 && (
        <p className="text-xs text-muted">
          Going:{" "}
          {going.slice(0, 2).map((u, i) => (
            <span key={u.id}>
              {i > 0 && ", "}
              <Link
                href={`/athletes/${u.id}`}
                className="font-medium text-fg hover:text-accent"
              >
                {u.username || "user"}
              </Link>
            </span>
          ))}
          {going.length > 2 && (
            <>
              {" "}
              and{" "}
              <button
                onClick={() => setParticipantsOpen(true)}
                className="font-medium text-fg hover:text-accent"
              >
                {going.length - 2} other{going.length - 2 === 1 ? "" : "s"}
              </button>
            </>
          )}
        </p>
      )}

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

      <EventParticipantsModal
        open={participantsOpen}
        eventId={event.id}
        currentUser={currentUser}
        onClose={() => setParticipantsOpen(false)}
      />
    </div>
  );
}
