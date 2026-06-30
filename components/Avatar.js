/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { initials, colorFromString } from "@/lib/helpers";

export default function Avatar({
  username,
  avatarUrl,
  size = 40,
  href,
  className = "",
  ring = false,
}) {
  const dim = { width: size, height: size };
  const ringCls = ring ? "ring-1 ring-white/10 shadow-lg shadow-black/30" : "";

  const inner = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={username || "avatar"}
      style={dim}
      className={`rounded-full border border-line object-cover ${ringCls}`}
    />
  ) : (
    <div
      style={{ ...dim, backgroundColor: colorFromString(username || "?") }}
      className={`flex items-center justify-center rounded-full font-semibold text-white ${ringCls}`}
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(username)}</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={`inline-block shrink-0 ${className}`}>
        {inner}
      </Link>
    );
  }
  return <span className={`inline-block shrink-0 ${className}`}>{inner}</span>;
}
