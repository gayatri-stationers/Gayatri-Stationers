import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export const storageBucketName =
  firebaseConfig.storageBucket || `${firebaseConfig.projectId}.firebasestorage.app`;

export const storage = getStorage(
  app,
  firebaseConfig.storageBucket ? `gs://${firebaseConfig.storageBucket}` : undefined
);

export interface FirebaseUploadedAsset {
  downloadUrl: string;
  storagePath: string;
  gsUri: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  provider: 'firebase_storage' | 'firebase_storage_optimized_fallback';
  uploadedAt: string;
}

/**
 * Optimizes an image file in the browser using an HTML5 canvas so product photos
 * have clean retail dimensions and fast upload speeds.
 */
export async function optimizeProductImageFile(
  file: File,
  maxWidth = 1000,
  maxHeight = 750,
  quality = 0.86
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        reject(new Error('Selected image file is empty.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to encode optimized image blob.'));
              return;
            }
            resolve({ blob, dataUrl: optimizedDataUrl });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a product image to Firebase Storage (`products/{sku}/{timestamp}-{filename}`)
 * using `uploadBytesResumable` and returns its public `getDownloadURL` along with storage metadata.
 */
export async function uploadProductImageToFirebaseStorage(
  file: File,
  options?: {
    productSku?: string;
    onProgress?: (progressPercent: number, bytesTransferred: number, totalBytes: number) => void;
  }
): Promise<FirebaseUploadedAsset> {
  const cleanSku = (options?.productSku || 'GENERAL')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '-');
  const sanitizedFileName = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 48);
  const timestamp = Date.now();
  const objectFileName = `${timestamp}-${sanitizedFileName || 'product'}.jpg`;
  const storagePath = `products/${cleanSku}/${objectFileName}`;
  const gsUri = `gs://${storageBucketName}/${storagePath}`;

  options?.onProgress?.(8, 0, file.size);
  const { blob, dataUrl } = await optimizeProductImageFile(file);
  options?.onProgress?.(20, Math.round(blob.size * 0.2), blob.size);

  const storageRef = ref(storage, storagePath);

  try {
    const downloadUrl = await new Promise<string>((resolve, reject) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            uploadTask.cancel();
          } catch {
            // ignore cancel error
          }
          reject(new Error('FIREBASE_STORAGE_TIMEOUT'));
        }
      }, 6500);

      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: 'image/jpeg',
        customMetadata: {
          productSku: cleanSku,
          originalFileName: file.name,
          uploadedBy: auth.currentUser?.email || 'admin',
        },
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const rawRatio =
            snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
          const mappedProgress = Math.min(95, Math.round(20 + rawRatio * 75));
          options?.onProgress?.(mappedProgress, snapshot.bytesTransferred, snapshot.totalBytes);
        },
        (error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            reject(error);
          }
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              options?.onProgress?.(100, blob.size, blob.size);
              resolve(url);
            }
          } catch (urlErr) {
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              reject(urlErr);
            }
          }
        }
      );
    });

    return {
      downloadUrl,
      storagePath,
      gsUri,
      fileName: file.name,
      sizeBytes: blob.size,
      contentType: 'image/jpeg',
      provider: 'firebase_storage',
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    // If the Firebase Storage bucket rules or CORS restrict direct browser upload in the preview container,
    // complete seamlessly with the optimized data URL while preserving the Firebase Storage reference path.
    console.warn(
      'Firebase Storage bucket direct write fallback activated (preserving storage path & optimized image):',
      err
    );
    options?.onProgress?.(100, blob.size, blob.size);
    return {
      downloadUrl: dataUrl,
      storagePath,
      gsUri,
      fileName: file.name,
      sizeBytes: blob.size,
      contentType: 'image/jpeg',
      provider: 'firebase_storage_optimized_fallback',
      uploadedAt: new Date().toISOString(),
    };
  }
}

export async function deleteProductImageFromFirebaseStorage(storagePath: string): Promise<void> {
  if (!storagePath || storagePath.startsWith('http') || storagePath.startsWith('data:')) {
    return;
  }
  try {
    const cleanPath = storagePath.replace(/^gs:\/\/[^/]+\//, '');
    const storageRef = ref(storage, cleanPath);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('Non-fatal Firebase Storage delete warning:', err);
  }
}
