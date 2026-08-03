export const ADMIN_HOST =
  process.env.NEXT_PUBLIC_ADMIN_HOST ?? "admin.casagrand.co.in";

const ADMIN_HOSTS = new Set([
  ADMIN_HOST,
  "hrportal.digilogy.co",
]);

const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** True on the admin portal domain (and localhost during local development). */
export function isAdminPortalHost(): boolean {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;
  if (ADMIN_HOSTS.has(hostname)) return true;

  return (
    process.env.NODE_ENV === "development" && LOCAL_DEV_HOSTS.has(hostname)
  );
}
