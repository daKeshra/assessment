"use client";

import { useCallback } from "react";

export default function CourseCtaLink({
  attemptToken,
  courseCode,
  href,
  children,
  className,
}: {
  attemptToken: string;
  courseCode: string;
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const track = useCallback(() => {
    const payload = JSON.stringify({
      attemptToken,
      courseCode,
      eventType: "CTA_CLICKED",
    });
    // keepalive lets the event finish while the browser follows a normal link.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/public/analytics/events",
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
    void fetch("/api/public/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }, [attemptToken, courseCode]);

  return (
    <a href={href} onClick={track} className={className}>
      {children}
    </a>
  );
}
