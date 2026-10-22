"use client";

import { useEffect } from "react";
import { installGlobalErrorHandlers } from "@/lib/errorReporter";

/** Mounted once in the root layout; renders nothing. */
export function ErrorReporter() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return null;
}
