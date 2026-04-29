import { Redis } from '@upstash/redis';

let _client: Redis | null = null;

export function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function client(): Redis {
  if (_client) return _client;
  if (!kvAvailable()) {
    throw new Error('KV not configured. Enable Vercel KV in the project storage tab.');
  }
  _client = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
  return _client;
}

// ——— Keys ———
const reportKey = (placeId: string) => `bloom:report:${placeId}`;
const userKey = (email: string) => `bloom:user:${email.toLowerCase()}`;
const purchaseKey = (sessionId: string) => `bloom:purchase:${sessionId}`;
const placesAllKey = 'bloom:places:all';

// ——— Reports ———
export async function getReport<T = any>(placeId: string): Promise<T | null> {
  if (!kvAvailable()) return null;
  return (await client().get<T>(reportKey(placeId))) || null;
}

export async function setReport(placeId: string, report: any): Promise<void> {
  if (!kvAvailable()) return;
  await client().set(reportKey(placeId), report);
  await client().sadd(placesAllKey, placeId);
}

export async function listAllPlaceIds(): Promise<string[]> {
  if (!kvAvailable()) return [];
  const ids = await client().smembers(placesAllKey);
  return Array.isArray(ids) ? (ids as string[]) : [];
}

// ——— Users ———
export type UserRecord = {
  email: string;
  placeIds: string[];
  createdAt: number;
};

export async function getUser(email: string): Promise<UserRecord | null> {
  if (!kvAvailable()) return null;
  return (await client().get<UserRecord>(userKey(email))) || null;
}

export async function addUserPlace(email: string, placeId: string): Promise<UserRecord> {
  if (!kvAvailable()) {
    return { email, placeIds: [placeId], createdAt: Date.now() };
  }
  const existing = (await client().get<UserRecord>(userKey(email))) || null;
  const nextIds = existing
    ? Array.from(new Set([...(existing.placeIds || []), placeId]))
    : [placeId];
  const next: UserRecord = {
    email,
    placeIds: nextIds,
    createdAt: existing?.createdAt || Date.now(),
  };
  await client().set(userKey(email), next);
  return next;
}

// ——— Purchases ———
export type PurchaseRecord = {
  sessionId: string;
  email: string;
  placeId: string;
  amount: number; // cents
  createdAt: number;
};

export async function recordPurchase(p: PurchaseRecord): Promise<void> {
  if (!kvAvailable()) return;
  await client().set(purchaseKey(p.sessionId), p);
}

export async function getPurchase(sessionId: string): Promise<PurchaseRecord | null> {
  if (!kvAvailable()) return null;
  return (await client().get<PurchaseRecord>(purchaseKey(sessionId))) || null;
}
