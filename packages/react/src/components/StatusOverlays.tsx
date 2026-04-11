import React from "react";
import type { LiveStatus } from "../hooks/useFlowPanelStream.js";

interface StatusOverlaysProps {
  liveStatus: LiveStatus;
  liveAnnouncement?: string;
}

export function StatusOverlays({ liveStatus, liveAnnouncement }: StatusOverlaysProps) {
  return (
    <>
      {/* ARIA live region */}
      <div
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        style={{
          position: "absolute",
          left: -9999,
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        {liveAnnouncement}
      </div>

      {/* SSE reconnect banner */}
      {liveStatus === "reconnecting" && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 52,
            left: 0,
            right: 0,
            zIndex: 20,
            background: "var(--fp-warn)",
            color: "#000",
            padding: "8px 24px",
            textAlign: "center",
            fontSize: 13,
          }}
        >
          Live updates paused — reconnecting...
        </div>
      )}
    </>
  );
}
