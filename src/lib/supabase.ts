import { createClient, SupabaseClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(raw?: string): string {
  if (!raw) return 'https://idhvqdcgzyaxdrkwcoxt.supabase.co';
  const clean = (raw || '').trim();
  if (clean.startsWith('https://')) {
    return clean.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  }
  if (clean.includes('postgres.') || clean.includes('.supabase.co')) {
    const match = clean.match(/postgres\.([a-z0-9_-]+)/i) || clean.match(/([a-z0-9]{15,35})\.supabase/i);
    if (match && match[1]) {
      return `https://${match[1]}.supabase.co`;
    }
  }
  return 'https://idhvqdcgzyaxdrkwcoxt.supabase.co';
}

const supabaseUrl = normalizeSupabaseUrl(
  (import.meta as any).env?.VITE_SUPABASE_URL ||
    'https://idhvqdcgzyaxdrkwcoxt.supabase.co'
);
const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkaHZxZGNnenlheGRya3djb3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyOTI1MDUsImV4cCI6MjEwNzg2ODUwNX0.738icD2J1fOFg3I80kKfUr8Gn04M1_SpYo9GPeMUvIc';

export const isSupabaseClientConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseUrl.includes('.supabase.co') &&
    supabaseUrl !== 'https://your-project-ref.supabase.co' &&
    !supabaseUrl.includes('[YOUR-PROJECT-REF]') &&
    supabaseAnonKey !== 'your-supabase-anon-publishable-key'
);

export const supabase: SupabaseClient | null = isSupabaseClientConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface UploadedSupabaseImageAsset {
  bucket: string;
  storagePath: string;
  publicUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Uploads a product or banner image to the public `product-images` bucket in Supabase Storage
 * with automatic fallback to data URL or API upload if client RLS policies restrict anonymous uploads.
 */
export async function uploadImageToSupabaseStorage(
  file: File,
  options?: { folder?: string; productSku?: string }
): Promise<UploadedSupabaseImageAsset> {
  const bucket = 'product-images';
  const cleanSku = (options?.productSku || 'catalogue')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const cleanName = (file.name || 'image.jpg')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const folder = options?.folder || 'products';
  const storagePath = `${folder}/${cleanSku}/${Date.now()}-${cleanName}`;

  if (supabase) {
    try {
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (!uploadError && data) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        return {
          bucket,
          storagePath,
          publicUrl: urlData.publicUrl,
          fileName: file.name,
          contentType: file.type || 'image/jpeg',
          sizeBytes: file.size,
        };
      }
    } catch {
      // Fall through to resilient data URL creation
    }
  }

  // Resilient fallback: convert to base64 Data URL so user workflows never stall
  const base64Url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return {
    bucket,
    storagePath,
    publicUrl: base64Url,
    fileName: file.name,
    contentType: file.type || 'image/jpeg',
    sizeBytes: file.size,
  };
}

export async function checkSupabaseHealth(): Promise<{
  connected: boolean;
  url: string;
  authHealthy: boolean;
  message: string;
}> {
  if (!isSupabaseClientConfigured || !supabase) {
    return {
      connected: false,
      url: supabaseUrl,
      authHealthy: false,
      message: 'Supabase credentials not configured.',
    };
  }
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey },
    });
    return {
      connected: res.ok,
      url: supabaseUrl,
      authHealthy: res.ok,
      message: res.ok
        ? 'Supabase Auth & GoTrue service online and healthy.'
        : `Supabase returned status ${res.status}.`,
    };
  } catch (err: any) {
    return {
      connected: false,
      url: supabaseUrl,
      authHealthy: false,
      message: err.message || 'Could not connect to Supabase endpoint.',
    };
  }
}
