import ResourceLockModel from "../../DB/models/resourceLock.model";
import { BadRequestException } from "../response/error.response";

const isDuplicateKeyError = (error: unknown): error is { code: number } => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === 11000;
};

// Tries to acquire the lock a few times with a short delay before giving up —
// handles the common case where the other request finishes in milliseconds.
const acquireLock = async (key: string, ttlMs = 5000, retries = 3): Promise<void> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await ResourceLockModel.create({ key, expiresAt: new Date(Date.now() + ttlMs) });
      return; // lock acquired
    } catch (error: unknown) {
      if (!isDuplicateKeyError(error)) throw error;

      if (attempt === retries) {
        throw new BadRequestException(
          "This item is currently being booked by someone else. Please try again in a moment."
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
};

const releaseLock = async (key: string): Promise<void> => {
  await ResourceLockModel.deleteOne({ key });
};

// Runs `fn` only while holding an exclusive lock on `key`.
// Guarantees the lock is released even if `fn` throws.
export const withLock = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  await acquireLock(key);
  try {
    return await fn();
  } finally {
    await releaseLock(key);
  }
};
