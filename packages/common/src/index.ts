export const ALLOWED_DOMAINS = [
  "casagrand.co.in",
  "casagrandcontracts.com",
  "digilogy.co",
  "casagrandtravelogy.co.in",
];

export function isDomainAllowed(email: string): boolean {
  const domain = email.split("@")[1];
  return ALLOWED_DOMAINS.includes(domain);
}
