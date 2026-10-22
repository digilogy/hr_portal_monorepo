"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/errorReporter";

// Catches errors in the root layout itself (e.g. AppLayout). It replaces the root
// layout when active, so it renders its own <html>/<body> and avoids antd.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportClientError({
      type: "render",
      message: error.message || "Root layout error",
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f9fafb",
          color: "#111827",
        }}
      >
        <title>Something went wrong</title>
        <div style={{ textAlign: "center", padding: 16 }}>
          <h2 style={{ margin: "0 0 8px" }}>Something went wrong</h2>
          <p style={{ margin: "0 0 16px", color: "#6b7280" }}>
            The portal hit an unexpected error. It has been reported.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: "#1677ff",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
