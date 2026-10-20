import { supabase } from './supabase.ts';

export interface SupabaseUploadResult {
  downloadUrl: string;
  storagePath: string;
  provider: 'supabase_storage' | 'supabase_api' | 'base64_fallback';
}

/**
 * Uploads an image file to Supabase Storage (bucket: 'product-images').
 * If client-side direct upload is blocked or unconfigured, it automatically falls back
 * to the backend /api/admin/upload-image endpoint (which uses the Supabase Service Role).
 */
export async function uploadImageToSupabaseStorage(
  file: File,
  options?: {
    productSku?: string;
    folder?: string;
    idToken?: string | null;
  }
): Promise<SupabaseUploadResult> {
  const sku = (options?.productSku || 'GENERAL')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '-');
  const folder = options?.folder || 'products';
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const storagePath = `${folder}/${sku}/${Date.now()}-${sanitizedName}`;

  // 1. Try client-side direct upload via Supabase JS Client
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (!error && data?.path) {
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(data.path);

        if (urlData?.publicUrl) {
          return {
            downloadUrl: urlData.publicUrl,
            storagePath: data.path,
            provider: 'supabase_storage',
          };
        }
      }
    } catch (clientErr) {
      console.warn('Client-side Supabase storage upload notice:', clientErr);
    }
  }

  // 2. Fallback to server-side endpoint (/api/admin/upload-image)
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file as base64.'));
    reader.readAsDataURL(file);
  });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.idToken) {
    headers.Authorization = `Bearer ${options.idToken}`;
  }

  const res = await fetch('/api/admin/upload-image', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base64Data,
      mimeType: file.type || 'image/jpeg',
      folder,
      skuOrSlug: sku,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    if (data.imageUrl) {
      return {
        downloadUrl: data.imageUrl,
        storagePath,
        provider: data.storageProvider === 'SUPABASE_STORAGE' ? 'supabase_storage' : 'supabase_api',
      };
    }
  }

  // 3. Graceful fallback
  return {
    downloadUrl: base64Data,
    storagePath,
    provider: 'base64_fallback',
  };
}
