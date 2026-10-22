"use client";

import { useEffect } from "react";
import { Button, Result } from "antd";
import { reportClientError } from "@/lib/errorReporter";

// Catches render errors in any page (inside the app shell) and reports them.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportClientError({
      type: "render",
      message: error.message || "Render error",
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <Result
      status="error"
      title="Something went wrong"
      subTitle="This page hit an unexpected error. It has been reported."
      extra={
        <Button type="primary" onClick={() => unstable_retry()}>
          Try again
        </Button>
      }
    />
  );
}
