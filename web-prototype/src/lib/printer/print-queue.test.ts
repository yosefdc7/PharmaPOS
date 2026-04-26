import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReprintQueueItem } from "@/lib/types";

const { deleteOne, getAll, putOne } = vi.hoisted(() => ({
  deleteOne: vi.fn(async () => undefined),
  getAll: vi.fn<() => Promise<ReprintQueueItem[]>>(async () => []),
  putOne: vi.fn(async () => undefined)
}));

vi.mock("@/lib/db", () => ({
  deleteOne,
  getAll,
  putOne
}));

import {
  base64ToCommands,
  clearPrintedJobs,
  commandsToBase64,
  enqueuePrintJob,
  markJobStatus
} from "./print-queue";

function buildQueueJob(overrides: Partial<ReprintQueueItem> = {}): ReprintQueueItem {
  return {
    id: overrides.id ?? "job-1",
    orNumber: overrides.orNumber ?? 101,
    transactionId: overrides.transactionId ?? "txn-1",
    profileId: overrides.profileId ?? "printer-1",
    commandsBase64: overrides.commandsBase64 ?? "abc",
    variant: overrides.variant ?? "normal",
    jobType: overrides.jobType ?? "receipt",
    createdAt: overrides.createdAt ?? "2026-04-26T00:00:00.000Z",
    status: overrides.status ?? "pending",
    failureReason: overrides.failureReason
  };
}

describe("print queue persistence", () => {
  beforeEach(() => {
    deleteOne.mockClear();
    getAll.mockClear();
    putOne.mockClear();
  });

  it("stores profileId, commandsBase64, variant, and jobType when enqueueing", async () => {
    const job = await enqueuePrintJob(991, "txn-1", "normal", new Uint8Array([27, 64]), "printer-1");

    expect(job.profileId).toBe("printer-1");
    expect(job.variant).toBe("normal");
    expect(job.jobType).toBe("receipt");
    expect(job.commandsBase64).toBe(commandsToBase64(new Uint8Array([27, 64])));
    expect(putOne).toHaveBeenCalledWith(
      "reprintQueue",
      expect.objectContaining({
        profileId: "printer-1",
        variant: "normal",
        jobType: "receipt"
      })
    );
  });

  it("updates an existing queue item status in place", async () => {
    getAll.mockResolvedValueOnce([buildQueueJob()]);

    await markJobStatus("job-1", "failed", "offline");

    expect(putOne).toHaveBeenCalledWith(
      "reprintQueue",
      expect.objectContaining({
        id: "job-1",
        status: "failed",
        failureReason: "offline"
      })
    );
  });

  it("clears only printed jobs from the queue", async () => {
    getAll.mockResolvedValueOnce([
      buildQueueJob({ id: "printed-1", status: "printed" }),
      buildQueueJob({ id: "pending-1", status: "pending" })
    ]);

    await clearPrintedJobs();

    expect(deleteOne).toHaveBeenCalledTimes(1);
    expect(deleteOne).toHaveBeenCalledWith("reprintQueue", "printed-1");
  });

  it("round-trips commands through base64 encoding", () => {
    const original = new Uint8Array([27, 64, 29, 86]);
    const encoded = commandsToBase64(original);

    expect(Array.from(base64ToCommands(encoded))).toEqual(Array.from(original));
  });
});
