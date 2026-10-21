import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ override: true });

export function normalizeSupabaseUrl(raw?: string): string {
  if (!raw) return 'https://idhvqdcgzyaxdrkwcoxt.supabase.co';
  const clean = (raw || '').trim();
  if (clean.startsWith('https://')) {
    return clean.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  }
  // If a Postgres URI was passed in SUPABASE_URL (e.g. postgresql://postgres.ref:pass@pooler...)
  if (clean.includes('postgres.') || clean.includes('.supabase.co')) {
    const match = clean.match(/postgres\.([a-z0-9_-]+)/i) || clean.match(/([a-z0-9]{15,35})\.supabase/i);
    if (match && match[1]) {
      return `https://${match[1]}.supabase.co`;
    }
  }
  return 'https://idhvqdcgzyaxdrkwcoxt.supabase.co';
}

let runtimeSupabaseUrl = normalizeSupabaseUrl(
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_URL.startsWith('https://')
    ? process.env.VITE_SUPABASE_URL
    : process.env.SUPABASE_URL || 'https://idhvqdcgzyaxdrkwcoxt.supabase.co'
);
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkaHZxZGNnenlheGRya3djb3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyOTI1MDUsImV4cCI6MjEwNzg2ODUwNX0.738icD2J1fOFg3I80kKfUr8Gn04M1_SpYo9GPeMUvIc';

export function isValidSupabaseUrl(url: string): boolean {
  const clean = normalizeSupabaseUrl(url);
  return Boolean(
    clean &&
      clean.startsWith('https://') &&
      clean.includes('.supabase.co') &&
      clean !== 'https://your-project-ref.supabase.co' &&
      !clean.includes('[YOUR-PROJECT-REF]')
  );
}

export const isSupabaseServiceRoleConfigured = Boolean(
  supabaseServiceRoleKey &&
    supabaseServiceRoleKey !== 'your-supabase-service-role-secret-key'
);

export const isSupabaseAnonKeyConfigured = Boolean(
  supabaseAnonKey &&
    supabaseAnonKey !== 'your-supabase-anon-publishable-key'
);

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isValidSupabaseUrl(runtimeSupabaseUrl)) return null;
  const key = supabaseServiceRoleKey || supabaseAnonKey;
  if (!key) return null;
  return createClient(runtimeSupabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function setRuntimeSupabaseUrl(url: string) {
  const clean = normalizeSupabaseUrl(url);
  if (isValidSupabaseUrl(clean)) {
    runtimeSupabaseUrl = clean;
    process.env.SUPABASE_URL = clean;
    process.env.VITE_SUPABASE_URL = clean;
  }
}

/**
 * Server-only Supabase client getter. Never import this file in frontend components.
 */
export const supabaseAdmin: SupabaseClient | null = getSupabaseAdminClient();

let bucketChecked = false;
export async function ensureSupabaseStorageBucket(bucketName = 'product-images') {
  if (bucketChecked) return;
  const client = getSupabaseAdminClient();
  if (!client || !isSupabaseServiceRoleConfigured) return;
  try {
    const { data: buckets } = await client.storage.listBuckets();
    const exists = (buckets || []).some((b) => b.name === bucketName || b.id === bucketName);
    if (!exists) {
      await client.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 5242880,
      });
    }
    bucketChecked = true;
  } catch {
    // Ignore if bucket already exists or storage permissions are managed externally
  }
}

export async function uploadBase64ToSupabaseStorage(params: {
  base64Data: string;
  mimeType: string;
  folder: string;
  skuOrSlug: string;
}): Promise<string | null> {
  const client = getSupabaseAdminClient();
  if (!client) return null;
  try {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
    await ensureSupabaseStorageBucket(bucket);
    const rawBase64 = params.base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');
    const ext = params.mimeType.split('/')[1] || 'png';
    const safeSlug = params.skuOrSlug.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const objectPath = `${params.folder}/${safeSlug}-${Date.now()}.${ext}`;

    const { error } = await client.storage.from(bucket).upload(objectPath, buffer, {
      contentType: params.mimeType,
      upsert: true,
    });
    if (error) return null;

    const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

export function getSupabaseMigrationStatus() {
  return {
    primaryDatabaseEngine: 'PostgreSQL (Relational Schema — 28 Tables Active)',
    supabaseUrlConfigured: isValidSupabaseUrl(runtimeSupabaseUrl),
    supabaseUrl: isValidSupabaseUrl(runtimeSupabaseUrl) ? runtimeSupabaseUrl : null,
    supabaseRestEndpoint: isValidSupabaseUrl(runtimeSupabaseUrl)
      ? `${runtimeSupabaseUrl}/rest/v1/`
      : null,
    supabaseAnonKeyConfigured: isSupabaseAnonKeyConfigured,
    supabaseAnonKeyPrefix: isSupabaseAnonKeyConfigured
      ? `${supabaseAnonKey.slice(0, 18)}...`
      : null,
    supabaseServiceRoleConfigured: isSupabaseServiceRoleConfigured,
    supabaseServiceRoleKeyPrefix: isSupabaseServiceRoleConfigured
      ? `${supabaseServiceRoleKey.slice(0, 14)}... (Server-Only)`
      : null,
    storageBucketsTarget: ['product-images', 'cms-banners', 'brand-logos'],
    rlsMigrationFile: 'supabase/schema_and_rls.sql',
  };
}

export const getSupabaseMigrationReadiness = getSupabaseMigrationStatus;

export async function testSupabaseServerConnection() {
  const result: {
    status: 'ok' | 'warning' | 'error';
    url: string | null;
    authService: boolean;
    authVersion?: string;
    details: string;
  } = {
    status: 'ok',
    url: isValidSupabaseUrl(runtimeSupabaseUrl) ? runtimeSupabaseUrl : null,
    authService: false,
    details: '',
  };

  if (!isValidSupabaseUrl(runtimeSupabaseUrl)) {
    result.status = 'error';
    result.details = 'Supabase Project URL is invalid or not configured.';
    return result;
  }

  try {
    const res = await fetch(`${runtimeSupabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      result.authService = true;
      result.authVersion = data.version || 'v2';
      result.details = 'Supabase Auth & GoTrue service online and responsive.';
    } else {
      result.status = 'warning';
      result.details = `Supabase returned status ${res.status}.`;
    }
  } catch (err: any) {
    result.status = 'error';
    result.details = `Connection error: ${err.message}`;
  }

  return result;
}
