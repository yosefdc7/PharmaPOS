import { deleteOne, getAll, putOne } from "@/lib/db";
import type { PrintVariant, ReprintQueueItem, ReprintQueueItemStatus } from "@/lib/types";

const EXPIRY_MS = 5 * 60 * 1000;

export async function enqueuePrintJob(
  orNumber: number,
  transactionId: string,
  variant: PrintVariant,
  commands: Uint8Array,
  profileId: string
): Promise<ReprintQueueItem> {
  const item: ReprintQueueItem = {
    id: crypto.randomUUID(),
    orNumber,
    transactionId,
    profileId,
    commandsBase64: commandsToBase64(commands),
    variant,
    jobType:
      variant === "normal"
        ? "receipt"
        : variant === "void"
          ? "void-receipt"
          : variant === "reprint"
            ? "reprint"
            : variant,
    createdAt: new Date().toISOString(),
    status: "pending",
    failureReason: undefined
  };
  await putOne("reprintQueue", item);
  return item;
}

export async function markJobStatus(
  id: string,
  status: ReprintQueueItemStatus,
  reason?: string
): Promise<void> {
  const existing = (await getAll("reprintQueue")).find((i) => i.id === id);
  if (!existing) return;
  const updated: ReprintQueueItem = { ...existing, status, failureReason: reason ?? existing.failureReason };
  await putOne("reprintQueue", updated);
}

export async function removeJob(id: string): Promise<void> {
  await deleteOne("reprintQueue", id);
}

export async function getPendingJobs(): Promise<ReprintQueueItem[]> {
  const all = await getAll("reprintQueue");
  const now = Date.now();
  return all.filter((j) => {
    const age = now - new Date(j.createdAt).getTime();
    if (age > EXPIRY_MS && j.status !== "printed") {
      return false;
    }
    return j.status === "pending" || j.status === "failed";
  });
}

export async function getAllJobs(): Promise<ReprintQueueItem[]> {
  return getAll("reprintQueue");
}

export async function clearPrintedJobs(): Promise<void> {
  const all = await getAll("reprintQueue");
  for (const job of all) {
    if (job.status === "printed") {
      await deleteOne("reprintQueue", job.id);
    }
  }
}

export function commandsToBase64(commands: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < commands.byteLength; i++) {
    binary += String.fromCharCode(commands[i]);
  }
  return btoa(binary);
}

export function base64ToCommands(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
