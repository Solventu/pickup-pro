"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, ExternalLink, Trash2 } from "lucide-react";
import { formatDate, formatTime, hasValidCoords } from "@/lib/helpers";
import { deleteEventAsAdmin } from "@/lib/events";
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
  isAdmin = false,
  onDeleted,
}) {
  const isOfficial = event.type === "official";
  const max = event.max_players ?? 0;
  const full = max > 0 && count >= max && !joined;
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const going = event.participants_followed || [];

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteEventAsAdmin(event.id);
      onDeleted?.(event.id);
    } catch (err) {
      alert(err.message || "Could not delete event.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

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
    <div className="card card-hover relative flex h-full flex-col gap-3 p-5">
      {/* Badges + admin delete */}
      <div className="flex items-center gap-2">
        {event.sport && <span className="badge badge-sport">{event.sport}</span>}
        <span className={`badge ${isOfficial ? "badge-official" : "badge-casual"}`}>
          {isOfficial ? "Official" : "Casual"}
        </span>
        {isAdmin && (
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete event"
            title="Delete event"
            className="ml-auto shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        )}
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

      {/* Actions — pinned to the bottom so cards line up at equal height. */}
      <div className="mt-auto flex items-center gap-2 pt-1">
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

      {/* Admin delete confirmation — overlays the card. */}
      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[inherit] bg-bg/95 p-5 text-center backdrop-blur-sm">
          <div>
            <p className="text-sm font-medium text-fg">Delete this event?</p>
            <p className="mt-1 text-xs text-muted">
              This permanently removes “{event.title}” and everyone who joined.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="btn btn-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn btn-danger"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}

      <EventParticipantsModal
        open={participantsOpen}
        eventId={event.id}
        currentUser={currentUser}
        onClose={() => setParticipantsOpen(false)}
      />
    </div>
  );
}
