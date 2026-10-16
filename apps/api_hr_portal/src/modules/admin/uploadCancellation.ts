/** Upload jobs an admin has cancelled; the row loops check this and stop at the next row. */
const cancelledJobIds = new Set<string>();

export class UploadCancelledError extends Error {
  constructor(jobId: string) {
    super(`Upload job ${jobId} was cancelled`);
    this.name = "UploadCancelledError";
  }
}

export function markUploadCancelled(jobId: string): void {
  cancelledJobIds.add(jobId);
}

export function isUploadCancelled(jobId: string): boolean {
  return cancelledJobIds.has(jobId);
}

export function clearUploadCancelled(jobId: string): void {
  cancelledJobIds.delete(jobId);
}

export function throwIfUploadCancelled(jobId: string): void {
  if (cancelledJobIds.has(jobId)) throw new UploadCancelledError(jobId);
}
