/**
 * Encryption utilities for PHI-adjacent data in sync queue.
 * Uses Web Crypto API (AES-GCM) for symmetric encryption.
 */

// Key derivation from a stored master key (in production, use secure key management)
const MASTER_KEY_ID = "pharmapos-phi-key";
let cachedKey: CryptoKey | null = null;

/**
 * Get or generate the symmetric encryption key.
 * In production, this should be replaced with proper key management.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  // Check if key exists in IndexedDB
  if (typeof indexedDB !== "undefined") {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("pharmapos-keys", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("keys");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction("keys", "readonly");
      const stored = await new Promise<ArrayBuffer | null>((resolve, reject) => {
        const req = tx.objectStore("keys").get(MASTER_KEY_ID);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (stored) {
        cachedKey = await crypto.subtle.importKey(
          "raw",
          stored,
          { name: "AES-GCM" },
          false,
          ["encrypt", "decrypt"]
        );
        return cachedKey;
      }
    } catch {
      // Continue to generate new key
    }
  }

  // Generate new key
  cachedKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Store the key
  if (typeof indexedDB !== "undefined") {
    try {
      const exported = await crypto.subtle.exportKey("raw", cachedKey);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("pharmapos-keys", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("keys");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction("keys", "readwrite");
      tx.objectStore("keys").put(new Uint8Array(exported), MASTER_KEY_ID);
    } catch {
      // Key generation succeeded, storage is optional
    }
  }

  return cachedKey;
}

export interface EncryptedData {
  ciphertext: string; // Base64-encoded
  iv: string; // Base64-encoded
}

/**
 * Encrypt a payload using AES-GCM.
 * @param plaintext - JSON-serializable object to encrypt
 * @returns Encrypted data with ciphertext and IV
 */
export async function encryptPayload(plaintext: unknown): Promise<EncryptedData> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(plaintext));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypt a payload using AES-GCM.
 * @param encrypted - Encrypted data with ciphertext and IV
 * @returns Decrypted JSON object
 */
export async function decryptPayload<T = unknown>(encrypted: EncryptedData): Promise<T> {
  const key = await getEncryptionKey();
  const iv = Uint8Array.from(atob(encrypted.iv), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

/**
 * Check if a sync queue entity contains PHI that needs encryption.
 * Entities like prescription drafts contain sensitive patient data.
 */
export function entityContainsPhi(entity: string): boolean {
  const phiEntities = ["prescription", "rx", "patient"];
  return phiEntities.some((phi) => entity.toLowerCase().includes(phi));
}

/**
 * Check if a payload contains PHI fields that should be encrypted.
 */
export function payloadContainsPhi(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const phiFields = ["patientName", "patientAddress", "prescriberName", "diagnosis", "medication"];
  const keys = Object.keys(payload as Record<string, unknown>);
  return phiFields.some((field) => keys.includes(field));
}