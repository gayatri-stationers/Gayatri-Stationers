import React, { useState, useRef } from 'react';
import { ProductIllustration } from './ProductIllustration.tsx';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Star,
  Trash2,
  Link2,
  FolderKanban,
  RefreshCw,
  Camera,
  Crop,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

export interface SupabaseUploadedAsset {
  bucket: string;
  storagePath: string;
  downloadUrl: string;
  gsUri: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface UploadQueueItem {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  bytesTransferred: number;
  status: 'uploading' | 'completed' | 'error';
  asset?: SupabaseUploadedAsset;
  errorMessage?: string;
}

interface FirebaseImageUploadProps {
  products: any[];
  selectedProductId: number | null;
  onSelectProductId: (productId: number) => void;
  idToken: string | null;
  onProductImagesUpdated: (updatedProduct: any, message: string) => Promise<void> | void;
  /** Optional form callback when used inside the Create/Edit Product form */
  onFormImagesUploaded?: (primaryUrl: string, allUploadedUrls: string[]) => void;
  formSku?: string;
  formProductName?: string;
  compactMode?: boolean;
}

async function processAndCropImageFile(
  file: File,
  cropPreset: '4:3' | '1:1' | '16:9' | 'original'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file format.'));
      img.onload = () => {
        let srcX = 0;
        let srcY = 0;
        let srcW = img.width;
        let srcH = img.height;

        if (cropPreset !== 'original') {
          const targetRatio =
            cropPreset === '4:3' ? 4 / 3 : cropPreset === '1:1' ? 1 : 16 / 9;
          const currentRatio = img.width / img.height;
          if (currentRatio > targetRatio) {
            srcW = Math.round(img.height * targetRatio);
            srcX = Math.round((img.width - srcW) / 2);
          } else {
            srcH = Math.round(img.width / targetRatio);
            srcY = Math.round((img.height - srcH) / 2);
          }
        }

        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
        const outW = Math.max(1, Math.round(srcW * scale));
        const outH = Math.max(1, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const FirebaseImageUpload: React.FC<FirebaseImageUploadProps> = ({
  products,
  selectedProductId,
  onSelectProductId,
  idToken,
  onProductImagesUpdated,
  onFormImagesUploaded,
  formSku,
  formProductName,
  compactMode = false,
}) => {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [setAsPrimaryOnUpload, setSetAsPrimaryOnUpload] = useState(true);
  const [autoAssociate, setAutoAssociate] = useState(true);
  const [associating, setAssociating] = useState(false);
  const [cropPreset, setCropPreset] = useState<'4:3' | '1:1' | '16:9' | 'original'>('4:3');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const activeProduct =
    products.find((p) => Number(p.id) === Number(selectedProductId)) || products[0] || null;

  const targetSku = compactMode
    ? formSku || activeProduct?.sku || 'NEW-ITEM'
    : activeProduct?.sku || 'GENERAL';

  const targetProductName = compactMode
    ? formProductName || activeProduct?.name || 'New Product'
    : activeProduct?.name || 'Select a Product';

  const currentGalleryUrls: string[] = React.useMemo(() => {
    if (!activeProduct) return [];
    const rawGallery = Array.isArray(activeProduct.galleryUrls) ? activeProduct.galleryUrls : [];
    const primary = activeProduct.imageUrl ? [activeProduct.imageUrl] : [];
    return Array.from(new Set([...primary, ...rawGallery].filter(Boolean)));
  }, [activeProduct]);

  const associateUrlsWithProduct = async (
    productId: number,
    urlsToAssociate: string[],
    makePrimary: boolean,
    exactGalleryOrder?: string[]
  ) => {
    if (!productId) return;
    setAssociating(true);
    setErrorMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const res = await fetch(`/api/admin/products/${productId}/images`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageUrl: makePrimary ? urlsToAssociate[0] : undefined,
          newImageUrls: urlsToAssociate.length > 0 ? urlsToAssociate : undefined,
          galleryUrls: exactGalleryOrder,
          setAsPrimary: makePrimary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to associate image with product.');
      }

      const prodName =
        products.find((p) => Number(p.id) === Number(productId))?.name || `Product #${productId}`;
      const msg = `Updated Supabase Storage media for "${prodName}".`;
      setStatusMessage(msg);
      await onProductImagesUpdated(data.product, msg);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to associate uploaded image with product.');
    } finally {
      setAssociating(false);
    }
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);
    setStatusMessage(null);

    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      setErrorMessage('Please select valid image files (JPG, PNG, WebP).');
      return;
    }

    const newItems: UploadQueueItem[] = files.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      fileName: file.name,
      fileSize: file.size,
      progress: 25,
      bytesTransferred: 0,
      status: 'uploading',
    }));

    setUploadQueue((prev) => [...newItems, ...prev]);

    const uploadedUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const queueItem = newItems[i];

      try {
        const base64DataUrl = await processAndCropImageFile(file, cropPreset);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (idToken) headers.Authorization = `Bearer ${idToken}`;

        const upRes = await fetch('/api/admin/upload-image', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            base64Data: base64DataUrl,
            mimeType: 'image/jpeg',
            folder: 'products',
            skuOrSlug: targetSku,
          }),
        });
        const upData = await upRes.json();
        const finalUrl = upData.imageUrl || base64DataUrl;

        const asset: SupabaseUploadedAsset = {
          bucket: 'product-images',
          storagePath: `products/${targetSku}/${file.name}`,
          downloadUrl: finalUrl,
          gsUri: `supabase://product-images/products/${targetSku}`,
          fileName: file.name,
          contentType: 'image/jpeg',
          sizeBytes: file.size,
        };

        uploadedUrls.push(finalUrl);

        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id
              ? {
                  ...item,
                  progress: 100,
                  bytesTransferred: file.size,
                  status: 'completed',
                  asset,
                }
              : item
          )
        );
      } catch (err: any) {
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id
              ? {
                  ...item,
                  status: 'error',
                  errorMessage: err.message || 'Upload failed',
                }
              : item
          )
        );
      }
    }

    if (uploadedUrls.length > 0) {
      if (onFormImagesUploaded) {
        onFormImagesUploaded(uploadedUrls[0], uploadedUrls);
      }

      if (!compactMode && autoAssociate && activeProduct?.id) {
        await associateUrlsWithProduct(activeProduct.id, uploadedUrls, setAsPrimaryOnUpload);
      } else if (compactMode) {
        setStatusMessage(
          `Uploaded ${uploadedUrls.length} image${
            uploadedUrls.length > 1 ? 's' : ''
          } to Supabase Storage (product-images) and attached to product form.`
        );
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handlePromoteToPrimary = async (imageUrl: string) => {
    if (!activeProduct?.id) return;
    await associateUrlsWithProduct(activeProduct.id, [imageUrl], true);
  };

  const handleMoveGalleryImage = async (index: number, direction: -1 | 1) => {
    if (!activeProduct?.id) return;
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= currentGalleryUrls.length) return;
    const reordered = [...currentGalleryUrls];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIdx, 0, moved);
    await associateUrlsWithProduct(activeProduct.id, [reordered[0]], true, reordered);
  };

  const handleRemoveImageFromProduct = async (imageUrlToRemove: string) => {
    if (!activeProduct?.id) return;
    setAssociating(true);
    setErrorMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const res = await fetch(`/api/admin/products/${activeProduct.id}/images`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          removeImageUrl: imageUrlToRemove,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove product image.');
      }
      const msg = `Removed image from "${activeProduct.name}".`;
      setStatusMessage(msg);
      await onProductImagesUpdated(data.product, msg);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove image.');
    } finally {
      setAssociating(false);
    }
  };

  const unassociatedCompletedUrls = uploadQueue
    .filter((item) => item.status === 'completed' && item.asset?.downloadUrl)
    .map((item) => item.asset!.downloadUrl)
    .filter((url) => !currentGalleryUrls.includes(url));

  return (
    <div className="bg-white border border-slate-200/80 rounded-[32px] p-5 sm:p-6 space-y-5 shadow-xs">
      {/* Header & Supabase Storage Bucket Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-[#B42318]" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Mobile Camera, Gallery & Crop Studio (Supabase Storage)
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Take a product photo with your phone camera or select from your gallery, auto-crop to your preferred card ratio, and reorder or promote gallery photos.
          </p>
        </div>
        <div className="text-xs font-mono-tabular text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
          Supabase Bucket: product-images
        </div>
      </div>

      {/* Status & Error Banners */}
      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-800 underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-full flex items-center justify-between text-xs text-red-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-800 underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Product Target Selector, Aspect Crop & Upload Dropzone */}
        <div className="lg:col-span-7 space-y-4">
          {!compactMode && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    1. Select Product to Manage Photos
                  </label>
                  <select
                    value={activeProduct?.id || ''}
                    onChange={(e) => onSelectProductId(Number(e.target.value))}
                    className="w-full px-4 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-full font-medium text-slate-900"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name} ({p.categoryName})
                        {p.imageUrl ? ' [Custom Photo]' : ' [Vector Default]'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-4 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    2. Auto-Crop Ratio
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200 text-xs">
                    {(['4:3', '1:1', 'original'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCropPreset(preset)}
                        className={`flex-1 py-1.5 rounded-full font-semibold transition-colors cursor-pointer ${
                          cropPreset === preset
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {preset === 'original' ? 'Full' : preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visual Product Picker Strip with Images */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-semibold text-slate-600">
                  Or tap any product below with image preview:
                </span>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 no-scrollbar">
                  {products.map((p) => {
                    const isSelected = Number(activeProduct?.id) === Number(p.id);
                    return (
                      <button
                        key={`vis-pick-${p.id}`}
                        type="button"
                        onClick={() => onSelectProductId(Number(p.id))}
                        className={`flex items-center gap-2.5 p-2 pr-3.5 rounded-2xl border text-left shrink-0 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="w-11 h-9 rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50 shrink-0">
                          <ProductIllustration
                            type={p.illustrationType}
                            imageUrl={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0 max-w-[140px]">
                          <p className="text-[11px] font-bold truncate">{p.name}</p>
                          <p
                            className={`text-[10px] font-mono-tabular truncate ${
                              isSelected ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {p.sku}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Mobile-Friendly Camera + Gallery Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFilesSelected(e.dataTransfer.files);
            }}
            className={`border-2 border-dashed rounded-[28px] p-5 text-center transition-colors ${
              isDragging
                ? 'border-[#B42318] bg-amber-50/50'
                : 'border-slate-300 bg-slate-50 hover:border-slate-500'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <UploadCloud className="w-7 h-7 text-slate-700 mx-auto mb-2" />
            <p className="text-xs sm:text-sm font-semibold text-slate-900">
              Take a photo with your phone camera or select from your gallery
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Auto-crops to <span className="font-mono font-semibold">{cropPreset}</span> and uploads directly to Supabase Storage (`product-images/{targetSku}`)
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B42318] text-white text-xs font-semibold rounded-full hover:bg-[#991B1B] cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Take Photo (Camera)</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-full hover:bg-slate-800 cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Choose from Gallery</span>
              </button>
            </div>
          </div>

          {/* Association Options */}
          {!compactMode && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setAsPrimaryOnUpload}
                    onChange={(e) => setSetAsPrimaryOnUpload(e.target.checked)}
                  />
                  <span>Set uploaded photo as Primary Cover Image</span>
                </label>
                <label className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAssociate}
                    onChange={(e) => setAutoAssociate(e.target.checked)}
                  />
                  <span>Auto-attach to selected product</span>
                </label>
              </div>

              {unassociatedCompletedUrls.length > 0 && activeProduct && (
                <button
                  type="button"
                  disabled={associating}
                  onClick={() =>
                    associateUrlsWithProduct(
                      activeProduct.id,
                      unassociatedCompletedUrls,
                      setAsPrimaryOnUpload
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B42318] text-white font-semibold rounded-full hover:bg-[#991B1B] disabled:opacity-50 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>
                    {associating
                      ? 'Saving...'
                      : `Attach ${unassociatedCompletedUrls.length} Photo(s) to ${activeProduct.sku}`}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Live Supabase Storage Upload Queue */}
          {uploadQueue.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-700">
                  Supabase Storage Upload History ({uploadQueue.length})
                </span>
                <button
                  type="button"
                  onClick={() => setUploadQueue([])}
                  className="text-slate-500 hover:text-slate-800 underline"
                >
                  Clear History
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {uploadQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-xs"
                  >
                    {item.asset?.downloadUrl ? (
                      <img
                        src={item.asset.downloadUrl}
                        alt={item.fileName}
                        className="w-12 h-9 object-cover rounded-xl border border-slate-300 shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-12 h-9 rounded-xl border border-slate-300 bg-slate-200 flex items-center justify-center shrink-0">
                        <RefreshCw className="w-3.5 h-3.5 text-slate-600 animate-spin" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 truncate">{item.fileName}</span>
                        <span className="font-mono-tabular font-semibold text-slate-700">
                          {item.status === 'uploading'
                            ? `${item.progress}%`
                            : item.status === 'completed'
                            ? 'Saved to Supabase'
                            : 'Failed'}
                        </span>
                      </div>
                      {item.errorMessage && (
                        <p className="text-[11px] text-red-700 mt-1">{item.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Selected Product Live Preview & Reorderable Gallery */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Storefront Media & Gallery Order
              </p>
              <p className="text-xs font-semibold text-slate-900 truncate mt-0.5">
                {targetProductName} ({targetSku})
              </p>
            </div>
            <Crop className="w-4 h-4 text-slate-500 shrink-0" />
          </div>

          {/* Primary Storefront Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">Primary Cover Photo (4:3):</span>
              <span className="font-mono-tabular text-[11px] text-slate-500">
                {activeProduct?.imageUrl ? 'Custom Photo Active' : 'Studio Vector Default'}
              </span>
            </div>
            <div className="aspect-4/3 w-full rounded-2xl border border-slate-300 overflow-hidden bg-slate-50">
              <ProductIllustration
                type={activeProduct?.illustrationType || 'spiral_notebook'}
                imageUrl={activeProduct?.imageUrl}
                alt={targetProductName}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Gallery Thumbnails with Reorder, Promote & Remove */}
          {!compactMode && activeProduct && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  Product Gallery ({currentGalleryUrls.length})
                </span>
                <span className="text-[11px] text-slate-500">Reorder, promote, or remove</span>
              </div>

              {currentGalleryUrls.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  No uploaded photos yet. Take a photo or select from your gallery to attach it.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {currentGalleryUrls.map((url, idx) => {
                    const isPrimary = activeProduct.imageUrl === url;
                    return (
                      <div
                        key={`${idx}-${url.slice(-18)}`}
                        className={`border rounded-2xl p-1.5 bg-white space-y-1.5 ${
                          isPrimary ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'
                        }`}
                      >
                        <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                          <img
                            src={url}
                            alt={`${activeProduct.name} ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          {isPrimary ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-800">
                              <Star className="w-3 h-3 fill-emerald-700 text-emerald-700" />
                              Cover
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={associating}
                              onClick={() => handlePromoteToPrimary(url)}
                              className="text-[10px] font-semibold text-slate-700 hover:text-slate-950 underline cursor-pointer"
                            >
                              Set Cover
                            </button>
                          )}
                          <div className="flex items-center gap-0.5">
                            {idx > 0 && (
                              <button
                                type="button"
                                disabled={associating}
                                onClick={() => handleMoveGalleryImage(idx, -1)}
                                title="Move left"
                                className="p-0.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                            )}
                            {idx < currentGalleryUrls.length - 1 && (
                              <button
                                type="button"
                                disabled={associating}
                                onClick={() => handleMoveGalleryImage(idx, 1)}
                                title="Move right"
                                className="p-0.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={associating}
                              onClick={() => handleRemoveImageFromProduct(url)}
                              title="Remove image"
                              className="p-0.5 text-slate-500 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
