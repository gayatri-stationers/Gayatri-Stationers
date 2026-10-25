import React, { useState, useMemo } from 'react';
import {
  X,
  Scale,
  ShoppingBag,
  Trash2,
  Plus,
  Check,
  Store,
  Truck,
  Sparkles,
  Search,
  ArrowRight,
} from 'lucide-react';
import { formatPaiseToINR } from '../lib/domain-logic.ts';
import { ProductIllustration } from './ProductIllustration.tsx';

export interface ComparisonColorOption {
  label: string;
  shortLabel: string;
  swatch: string;
  border: string;
  variantId?: number;
}

interface ProductComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenModal: () => void;
  compareProductIds: number[];
  products: any[];
  selectedVariantByProduct: Record<number, number>;
  selectedColorByProduct: Record<number, string>;
  onSelectVariant: (productId: number, variantId: number) => void;
  onSelectColor: (productId: number, colorLabel: string, variantId?: number) => void;
  onToggleCompare: (productId: number) => void;
  onClearCompare: () => void;
  onAddToCart: (product: any, variantId?: number, colorLabel?: string) => void;
  onOpenProduct: (product: any) => void;
  getProductColorOptions: (product: any) => ComparisonColorOption[];
  compareToastMessage?: string | null;
  onDismissToast?: () => void;
}

/**
 * Derives comprehensive stationery specifications for a product by combining its explicit
 * `product.specifications` object with domain-aware attributes so the comparison table is always rich.
 */
function buildProductSpecificationsMap(product: any, activeVariant: any): Record<string, string> {
  const explicitSpecs: Record<string, any> =
    product?.specifications && typeof product.specifications === 'object'
      ? product.specifications
      : {};

  const nameLower = `${product?.name || ''} ${product?.shortDescription || ''} ${product?.description || ''}`.toLowerCase();
  const catLower = `${product?.categoryName || ''} ${product?.categorySlug || ''}`.toLowerCase();

  const derived: Record<string, string> = {};

  // 1. Copy explicit specifications first
  for (const [k, v] of Object.entries(explicitSpecs)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      derived[k] = String(v);
    }
  }

  // 2. Enrich with stationery-specific specifications if not already present
  if (catLower.includes('notebook') || catLower.includes('register') || catLower.includes('diar') || nameLower.includes('pages')) {
    if (!derived['Page Count']) {
      const pageMatch = `${product?.name || ''} ${activeVariant?.variantName || ''}`.match(/(\d{2,4})\s*pages?/i);
      derived['Page Count'] = pageMatch ? `${pageMatch[1]} Pages` : '180–240 Pages';
    }
    if (!derived['Paper GSM'] && !derived['Paper Quality']) {
      const gsmMatch = nameLower.match(/(\d{2,3})\s*gsm/i);
      derived['Paper GSM'] = gsmMatch ? `${gsmMatch[1]} GSM Elemental Chlorine-Free` : '70 GSM Bright White Paper';
    }
    if (!derived['Binding'] && !derived['Binding Type']) {
      derived['Binding'] = nameLower.includes('spiral')
        ? 'Twin-Wire Spiral Binding'
        : nameLower.includes('hardbound') || nameLower.includes('register')
        ? 'Section-Sewn Hardbound Spine'
        : 'Center-Stapled / Soft Cover';
    }
    if (!derived['Ruling']) {
      derived['Ruling'] = nameLower.includes('unruled')
        ? 'Unruled / Blank'
        : nameLower.includes('6-subject')
        ? 'Single Ruled with 6 Divider Tabs'
        : 'Single Line Ruled with Margin';
    }
  } else if (catLower.includes('pen') || catLower.includes('writing') || catLower.includes('pencil')) {
    if (!derived['Tip Size'] && !derived['Tip Type']) {
      const tipMatch = nameLower.match(/(0\.\d+)\s*mm/i);
      derived['Tip Size'] = tipMatch ? `${tipMatch[1]} mm Precision Tip` : '0.7 mm Fine Tip';
    }
    if (!derived['Ink / Lead Type'] && !derived['Ink Type'] && !derived['Ink System']) {
      derived['Ink / Lead Type'] = nameLower.includes('gel')
        ? 'Waterproof Pigment Gel Ink'
        : nameLower.includes('roller')
        ? 'Liquid Roller Regulator Ink'
        : nameLower.includes('pencil')
        ? 'Break-Resistant High-Polymer Lead'
        : 'Low-Viscosity Smudge-Free Ball Ink';
    }
    if (!derived['Barrel & Grip'] && !derived['Finish']) {
      derived['Barrel & Grip'] = nameLower.includes('matte')
        ? 'Ergonomic Matte Rubberised Grip'
        : 'Contoured Comfort Grip Barrel';
    }
  } else if (catLower.includes('art') || catLower.includes('craft') || catLower.includes('diy')) {
    if (!derived['Pigment / Medium']) {
      derived['Pigment / Medium'] = nameLower.includes('water')
        ? 'Water-Soluble Rich Colour Pigments'
        : nameLower.includes('acrylic')
        ? 'Artist-Grade Acrylic Pigment'
        : 'Smooth Blendable Studio Media';
    }
    if (!derived['Packaging']) {
      derived['Packaging'] = nameLower.includes('tin')
        ? 'Protective Metal Studio Tin'
        : 'Organised Studio Box Pack';
    }
  } else if (catLower.includes('geometry') || catLower.includes('school') || catLower.includes('math')) {
    if (!derived['Construction']) {
      derived['Construction'] = nameLower.includes('die-cast')
        ? 'Self-Centering Die-Cast Metal Instruments'
        : 'Precision Millimetre-Graduated Steel & Polymer';
    }
    if (!derived['Exam Compliance']) {
      derived['Exam Compliance'] = 'CBSE / ICSE & State Board Approved';
    }
  }

  if (!derived['Pack / Unit Specification']) {
    derived['Pack / Unit Specification'] =
      activeVariant?.variantName || activeVariant?.attributeValue || 'Standard Retail Pack';
  }

  if (!derived['Ideal For']) {
    derived['Ideal For'] =
      catLower.includes('art')
        ? 'Students, Fine Artists & Craft Projects'
        : catLower.includes('office') || catLower.includes('file')
        ? 'Offices, Institutions & Archiving'
        : 'School, Board Exams, College & Daily Office Use';
  }

  return derived;
}

export function ProductComparisonModal({
  isOpen,
  onClose,
  onOpenModal,
  compareProductIds,
  products,
  selectedVariantByProduct,
  selectedColorByProduct,
  onSelectVariant,
  onSelectColor,
  onToggleCompare,
  onClearCompare,
  onAddToCart,
  onOpenProduct,
  getProductColorOptions,
  compareToastMessage,
  onDismissToast,
}: ProductComparisonModalProps) {
  const [addSlotSearch, setAddSlotSearch] = useState('');
  const [highlightDiffsOnly, setHighlightDiffsOnly] = useState(false);

  const comparedProducts = useMemo(
    () =>
      compareProductIds
        .map((id) => products.find((p) => Number(p.id) === Number(id)))
        .filter(Boolean),
    [compareProductIds, products]
  );

  const availableToAddProducts = useMemo(() => {
    const q = addSlotSearch.trim().toLowerCase();
    return products
      .filter((p) => p && p.isActive !== false && !compareProductIds.includes(Number(p.id)))
      .filter((p) => {
        if (!q) return true;
        return (
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.brandName || '').toLowerCase().includes(q) ||
          String(p.categoryName || '').toLowerCase().includes(q) ||
          String(p.sku || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [products, compareProductIds, addSlotSearch]);

  // Compute lowest selling price to highlight best value when 2+ products are compared
  const lowestPricePaise = useMemo(() => {
    if (comparedProducts.length < 2) return null;
    const prices = comparedProducts.map((p) => {
      const selVarId = selectedVariantByProduct[p.id] || p.variants?.[0]?.id;
      const v = p.variants?.find((item: any) => Number(item.id) === Number(selVarId)) || p.variants?.[0];
      return Number(v?.sellingPricePaise ?? p.sellingPricePaise ?? 0);
    });
    return Math.min(...prices.filter((n) => n > 0));
  }, [comparedProducts, selectedVariantByProduct]);

  // Collect all specification keys across compared products
  const specRows = useMemo(() => {
    const specsByProdId: Record<number, Record<string, string>> = {};
    const allKeysSet = new Set<string>();

    for (const prod of comparedProducts) {
      const selVarId = selectedVariantByProduct[prod.id] || prod.variants?.[0]?.id;
      const activeVar =
        prod.variants?.find((v: any) => Number(v.id) === Number(selVarId)) || prod.variants?.[0];
      const map = buildProductSpecificationsMap(prod, activeVar);
      specsByProdId[prod.id] = map;
      Object.keys(map).forEach((k) => allKeysSet.add(k));
    }

    return Array.from(allKeysSet).map((key) => {
      const values = comparedProducts.map((p) => specsByProdId[p.id]?.[key] || '—');
      const uniqueNonDash = new Set(values);
      const isDifferent = comparedProducts.length > 1 && uniqueNonDash.size > 1;
      return {
        key,
        values,
        isDifferent,
      };
    });
  }, [comparedProducts, selectedVariantByProduct]);

  const emptySlotsCount = Math.max(0, 3 - comparedProducts.length);

  return (
    <>
      {/* Toast Notification for Comparison Limit / Status */}
      {compareToastMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-sm bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{compareToastMessage}</span>
          </div>
          {onDismissToast && (
            <button
              type="button"
              onClick={onDismissToast}
              className="text-slate-300 hover:text-white underline text-[11px] shrink-0 cursor-pointer"
            >
              OK
            </button>
          )}
        </div>
      )}

      {/* Floating Bottom Comparison Tray (when 1–3 products are selected and modal is closed) */}
      {comparedProducts.length > 0 && !isOpen && (
        <div className="fixed bottom-18 md:bottom-4 left-3 right-3 md:left-auto md:right-6 md:max-w-3xl z-40 bg-slate-900/95 backdrop-blur-xl text-white border border-slate-700/90 rounded-[28px] shadow-2xl p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5">
              <div className="flex items-center gap-1.5 pr-2 border-r border-slate-700 shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#B42318] flex items-center justify-center shrink-0">
                  <Scale className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                    COMPARE ITEMS
                  </p>
                  <p className="text-xs font-bold font-mono-tabular">
                    {comparedProducts.length} of 3 Selected
                  </p>
                </div>
              </div>

              {/* Selected product pills */}
              {comparedProducts.map((prod) => {
                const v =
                  prod.variants?.find(
                    (item: any) => Number(item.id) === Number(selectedVariantByProduct[prod.id])
                  ) || prod.variants?.[0];
                const price = v?.sellingPricePaise ?? prod.sellingPricePaise ?? 0;
                return (
                  <div
                    key={`tray-cmp-${prod.id}`}
                    className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 bg-slate-800/90 border border-slate-700 rounded-2xl shrink-0 max-w-[200px]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white overflow-hidden shrink-0">
                      <ProductIllustration
                        type={prod.illustrationType}
                        imageUrl={prod.imageUrl}
                        alt={prod.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-white truncate">{prod.name}</p>
                      <p className="text-[10px] font-mono-tabular text-amber-300 font-bold">
                        {formatPaiseToINR(price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleCompare(Number(prod.id))}
                      aria-label={`Remove ${prod.name} from comparison`}
                      className="w-5 h-5 rounded-full bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {/* Empty slot placeholders up to 3 */}
              {Array.from({ length: emptySlotsCount }).map((_, idx) => (
                <button
                  key={`empty-slot-${idx}`}
                  type="button"
                  onClick={onOpenModal}
                  className="px-3 py-2 rounded-2xl border border-dashed border-slate-600 hover:border-amber-400 text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item {comparedProducts.length + idx + 1}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClearCompare}
                className="px-3 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onOpenModal}
                className="px-4 py-2 rounded-full bg-[#B42318] hover:bg-[#991B1B] text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Compare Now ({comparedProducts.length}/3)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Side-by-Side Comparison Modal View */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Side-by-Side Product Comparison"
        >
          <div className="bg-white border border-slate-200 rounded-[28px] sm:rounded-[32px] shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 sm:px-7 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#B42318] flex items-center justify-center shrink-0">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif-display text-lg sm:text-xl font-bold tracking-tight">
                      Side-by-Side Stationery Comparison
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-300/30">
                      {comparedProducts.length} / 3 Selected
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Compare specifications, INR pricing, GST, pack variants, and colour options side-by-side
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {comparedProducts.length >= 2 && (
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={highlightDiffsOnly}
                      onChange={(e) => setHighlightDiffsOnly(e.target.checked)}
                      className="rounded"
                    />
                    <span>Highlight Differences</span>
                  </label>
                )}
                {comparedProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearCompare}
                    className="px-3.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close comparison table"
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Side-by-Side Table */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[#FAFAFA]">
              {comparedProducts.length === 0 ? (
                <div className="max-w-2xl mx-auto my-8 bg-white border border-slate-200 rounded-[28px] p-8 text-center space-y-5 shadow-xs">
                  <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center mx-auto">
                    <Scale className="w-7 h-7 text-[#B42318]" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-serif-display text-xl font-bold text-slate-900">
                      Select Up to 3 Products to Compare
                    </h3>
                    <p className="text-xs text-slate-600">
                      Pick products below or click the <strong>+ Compare</strong> button on any product card in the catalogue.
                    </p>
                  </div>

                  {/* Quick Search & Add in Empty State */}
                  <div className="max-w-md mx-auto">
                    <div className="flex items-center px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-full">
                      <Search className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={addSlotSearch}
                        onChange={(e) => setAddSlotSearch(e.target.value)}
                        placeholder="Search notebooks, pens, DOMS, Classmate..."
                        className="w-full px-2.5 text-xs bg-transparent focus:outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    {availableToAddProducts.slice(0, 6).map((p) => (
                      <button
                        key={`empty-pick-${p.id}`}
                        type="button"
                        onClick={() => onToggleCompare(Number(p.id))}
                        className="p-3 rounded-2xl border border-slate-200 hover:border-slate-900 bg-slate-50/70 hover:bg-white flex items-center justify-between gap-3 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-11 rounded-xl border border-slate-200 bg-white overflow-hidden shrink-0">
                            <ProductIllustration
                              type={p.illustrationType}
                              imageUrl={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono-tabular">
                              {p.brandName} · {formatPaiseToINR(p.sellingPricePaise)}
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-full shrink-0">
                          + Select
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-[24px] shadow-xs overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70">
                        <th className="w-48 sm:w-56 p-4 align-top font-mono uppercase tracking-wider text-[11px] text-slate-500 font-bold border-r border-slate-200">
                          <div className="space-y-2">
                            <span>Product Overview</span>
                            <p className="text-[11px] font-sans font-normal normal-case text-slate-500 leading-relaxed">
                              Select up to 3 stationery items to compare pricing, variants, and technical specs side-by-side.
                            </p>
                          </div>
                        </th>

                        {comparedProducts.map((prod) => {
                          const selVarId =
                            selectedVariantByProduct[prod.id] || prod.variants?.[0]?.id;
                          const activeVar =
                            prod.variants?.find((v: any) => Number(v.id) === Number(selVarId)) ||
                            prod.variants?.[0];
                          const price = activeVar?.sellingPricePaise ?? prod.sellingPricePaise ?? 0;
                          const stock = activeVar?.stockQuantity ?? prod.totalStock ?? 0;
                          const activeColor =
                            selectedColorByProduct[prod.id] ||
                            getProductColorOptions(prod)[0]?.label;

                          return (
                            <th
                              key={`cmp-col-${prod.id}`}
                              className="w-64 sm:w-72 p-4 align-top border-r border-slate-200 last:border-r-0 font-normal"
                            >
                              <div className="space-y-3">
                                <div className="relative aspect-4/3 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onOpenProduct(prod);
                                    }}
                                    className="w-full h-full block cursor-pointer"
                                  >
                                    <ProductIllustration
                                      type={prod.illustrationType}
                                      imageUrl={prod.imageUrl}
                                      alt={prod.name}
                                      colorTint={activeColor}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onToggleCompare(Number(prod.id))}
                                    title="Remove from comparison"
                                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/95 hover:bg-red-600 text-slate-700 hover:text-white border border-slate-200 shadow-xs flex items-center justify-center cursor-pointer transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                  {lowestPricePaise !== null && price === lowestPricePaise && (
                                    <span className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-mono uppercase tracking-wider font-bold shadow-xs">
                                      Lowest Price
                                    </span>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#B42318] font-bold">
                                    {prod.brandName} · {prod.categoryName}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onOpenProduct(prod);
                                    }}
                                    className="font-bold text-sm text-slate-900 hover:underline text-left line-clamp-2 cursor-pointer"
                                  >
                                    {prod.name}
                                  </button>
                                  <p className="text-[11px] text-slate-500 line-clamp-2">
                                    {prod.shortDescription}
                                  </p>
                                </div>

                                <div className="pt-1 flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={stock <= 0}
                                    onClick={() => {
                                      onClose();
                                      onAddToCart(prod, activeVar?.id, activeColor);
                                    }}
                                    className="flex-1 py-2 px-3 bg-[#B42318] hover:bg-[#991B1B] disabled:bg-slate-300 text-white text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                                  >
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                    <span>
                                      {stock > 0
                                        ? `Add (${formatPaiseToINR(price)})`
                                        : 'Out of Stock'}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onOpenProduct(prod);
                                    }}
                                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-full cursor-pointer"
                                  >
                                    View
                                  </button>
                                </div>
                              </div>
                            </th>
                          );
                        })}

                        {/* If fewer than 3 items selected, render interactive Add Product Slot column */}
                        {comparedProducts.length < 3 && (
                          <th className="w-64 sm:w-72 p-4 align-top bg-slate-50/40 font-normal">
                            <div className="h-full border-2 border-dashed border-slate-300 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                                    SLOT {comparedProducts.length + 1} OF 3
                                  </span>
                                  <Plus className="w-4 h-4 text-slate-400" />
                                </div>
                                <p className="text-xs font-bold text-slate-800">
                                  Add Product to Compare
                                </p>
                                <div className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-full">
                                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <input
                                    type="text"
                                    value={addSlotSearch}
                                    onChange={(e) => setAddSlotSearch(e.target.value)}
                                    placeholder="Filter catalogue..."
                                    className="w-full px-2 text-[11px] bg-transparent focus:outline-none text-slate-900"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                {availableToAddProducts.map((cand) => (
                                  <button
                                    key={`slot-add-${cand.id}`}
                                    type="button"
                                    onClick={() => onToggleCompare(Number(cand.id))}
                                    className="w-full p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                                        <ProductIllustration
                                          type={cand.illustrationType}
                                          imageUrl={cand.imageUrl}
                                          alt={cand.name}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-semibold text-slate-900 truncate">
                                          {cand.name}
                                        </p>
                                        <p className="text-[10px] font-mono-tabular text-slate-500">
                                          {formatPaiseToINR(cand.sellingPricePaise)}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded-full shrink-0">
                                      + Add
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </th>
                        )}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {/* SECTION HEADER 1: PRICING & SAVINGS */}
                      <tr className="bg-slate-100/90">
                        <td
                          colSpan={comparedProducts.length + 1 + (comparedProducts.length < 3 ? 1 : 0)}
                          className="px-4 py-2 font-mono uppercase tracking-wider text-[10px] font-bold text-slate-700"
                        >
                          1. Pricing, Savings &amp; Tax Breakdown (INR / ₹)
                        </td>
                      </tr>

                      {/* Row: Selling Price */}
                      <tr>
                        <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          Selling Price (INR)
                        </td>
                        {comparedProducts.map((prod) => {
                          const selVarId =
                            selectedVariantByProduct[prod.id] || prod.variants?.[0]?.id;
                          const activeVar =
                            prod.variants?.find((v: any) => Number(v.id) === Number(selVarId)) ||
                            prod.variants?.[0];
                          const price = activeVar?.sellingPricePaise ?? prod.sellingPricePaise ?? 0;
                          const isLowest = lowestPricePaise !== null && price === lowestPricePaise;
                          return (
                            <td
                              key={`price-${prod.id}`}
                              className={`p-3.5 font-mono-tabular border-r border-slate-200 last:border-r-0 ${
                                isLowest ? 'bg-emerald-50/50' : ''
                              }`}
                            >
                              <span className="text-base font-bold text-slate-900">
                                {formatPaiseToINR(price)}
                              </span>
                              {isLowest && (
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-sans font-bold">
                                  Best Price
                                </span>
                              )}
                            </td>
                          );
                        })}
                        {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                      </tr>

                      {/* Row: MRP */}
                      <tr>
                        <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          Maximum Retail Price (MRP)
                        </td>
                        {comparedProducts.map((prod) => {
                          const selVarId =
                            selectedVariantByProduct[prod.id] || prod.variants?.[0]?.id;
                          const activeVar =
                            prod.variants?.find((v: any) => Number(v.id) === Number(selVarId)) ||
                            prod.variants?.[0];
                          const mrp = activeVar?.mrpPaise ?? prod.mrpPaise ?? 0;
                          return (
                            <td
                              key={`mrp-${prod.id}`}
                              className="p-3.5 font-mono-tabular text-slate-500 line-through border-r border-slate-200 last:border-r-0"
                            >
                              {formatPaiseToINR(mrp)}
                            </td>
                          );
                        })}
                        {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                      </tr>

                      {/* Row: Direct Retail Savings */}
                      <tr>
                        <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          Customer Savings
                        </td>
                        {comparedProducts.map((prod) => {
                          const selVarId =
                            selectedVariantByProduct[prod.id] || prod.variants?.[0]?.id;
                          const activeVar =
                            prod.variants?.find((v: any) => Number(v.id) === Number(selVarId)) ||
                            prod.variants?.[0];
                          const price = activeVar?.sellingPricePaise ?? prod.sellingPricePaise ?? 0;
                          const mrp = activeVar?.mrpPaise ?? prod.mrpPaise ?? price;
                          const savedPaise = Math.max(0, mrp - price);
                          const pct = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
                          return (
                            <td
                              key={`save-${prod.id}`}
                              className="p-3.5 font-mono-tabular border-r border-slate-200 last:border-r-0"
                            >
                              {savedPaise > 0 ? (
                                <span className="text-emerald-800 font-bold">
                                  Save {formatPaiseToINR(savedPaise)} ({pct}% OFF)
                                </span>
                              ) : (
                                <span className="text-slate-500">Standard Retail Rate</span>
                              )}
                            </td>
                          );
                        })}
                        {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                      </tr>

                      {/* Row: GST Tax Rate */}
                      <tr>
                        <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          GST Rate (Inclusive)
                        </td>
                        {comparedProducts.map((prod) => (
                          <td
                            key={`gst-${prod.id}`}
                            className="p-3.5 font-mono-tabular text-slate-700 border-r border-slate-200 last:border-r-0"
                          >
                            {Number(prod.taxRatePercent ?? prod.gstRatePercent ?? 12)}% GST Included in Price
                          </td>
                        ))}
                        {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                      </tr>

                      {/* SECTION HEADER 2: VARIANTS & PACK OPTIONS */}
                      <tr className="bg-slate-100/90">
                        <td
                          colSpan={comparedProducts.length + 1 + (comparedProducts.length < 3 ? 1 : 0)}
                          className="px-4 py-2 font-mono uppercase tracking-wider text-[10px] font-bold text-slate-700"
                        >
                          2. Variants, Pack Sizes &amp; Colour Options
                        </td>
                      </tr>

                      {/* Row: Active Variant Switcher */}
                      <tr>
                        <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          Selected Variant / Pack
                        </td>
                        {comparedProducts.map((prod) => {
                          const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
                          const selVarId = selectedVariantByProduct[prod.id] || variants[0]?.id;
                          return (
                            <td
                              key={`selvar-${prod.id}`}
                              className="p-3.5 border-r border-slate-200 last:border-r-0"
                            >
                              {variants.length > 1 ? (
                                <select
                                  aria-label={`Select variant for ${prod.name}`}
                                  value={selVarId}
                                  onChange={(e) =>
                                    onSelectVariant(prod.id, Number(e.target.value))
                                  }
                                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium"
                                >
                                  {variants.map((v: any) => (
                                    <option key={v.id} value={v.id}>
                                      {v.variantName} — {formatPaiseToINR(v.sellingPricePaise)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="font-medium text-slate-800">
                                  {variants[0]?.variantName || 'Standard Retail Pack'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                      </tr>

                      {/* Row: Complete Variants Breakdown List */}
                      <tr>
                        <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          All Available Variants ({' '}
                          <span className="font-mono-tabular">Pack &amp; Price Matrix</span> )
                        </td>
                        {comparedProducts.map((prod) => {
                          const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
                          const selVarId = selectedVariantByProduct[prod.id] || variants[0]?.id;
                          return (
                            <td
                              key={`allvars-${prod.id}`}
                              className="p-3.5 border-r border-slate-200 last:border-r-0 align-top"
                            >
                              <div className="space-y-1.5">
                                {variants.map((v: any) => {
                                  const isSelected = Number(v.id) === Number(selVarId);
                                  return (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() => onSelectVariant(prod.id, Number(v.id))}
                                      className={`w-full p-2 rounded-xl border text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                        isSelected
                                          ? 'bg-slate-900 text-white border-slate-900'
                                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-semibold truncate">
                                          {v.variantName}
                                        </p>
                                        <p
                                          className={`text-[10px] font-mono-tabular ${
                                            isSelected ? 'text-slate-300' : 'text-slate-500'
                                          }`}
                                        >
                                          SKU: {v.sku || prod.sku} · {v.stockQuantity ?? 25} in stock
                                        </p>
                                      </div>
                                      <span
                                        className={`font-mono-tabular text-xs font-bold shrink-0 ${
                                          isSelected ? 'text-amber-300' : 'text-slate-900'
                                        }`}
                                      >
                                        {formatPaiseToINR(v.sellingPricePaise)}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                        {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                      </tr>

                      {/* Row: Colour / Ink Options */}
                      <tr>
                        <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          Ink / Colour Swatches
                        </td>
                        {comparedProducts.map((prod) => {
                          const colors = getProductColorOptions(prod);
                          const activeColor =
                            selectedColorByProduct[prod.id] || colors[0]?.label;
                          return (
                            <td
                              key={`colors-${prod.id}`}
                              className="p-3.5 border-r border-slate-200 last:border-r-0"
                            >
                              {colors.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {colors.map((c) => {
                                    const isSel = activeColor === c.label;
                                    return (
                                      <button
                                        key={c.label}
                                        type="button"
                                        onClick={() =>
                                          onSelectColor(prod.id, c.label, c.variantId)
                                        }
                                        className={`px-2.5 py-1 rounded-full border text-[11px] flex items-center gap-1.5 cursor-pointer transition-all ${
                                          isSel
                                            ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                                        }`}
                                      >
                                        <span
                                          className="w-3 h-3 rounded-full shrink-0"
                                          style={{
                                            background: c.swatch,
                                            border: `1px solid ${c.border}`,
                                          }}
                                        />
                                        <span>{c.shortLabel}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-slate-500">Standard Studio Edition</span>
                              )}
                            </td>
                          );
                        })}
                        {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                      </tr>

                      {/* SECTION HEADER 3: TECHNICAL SPECIFICATIONS & AVAILABILITY */}
                      <tr className="bg-slate-100/90">
                        <td
                          colSpan={comparedProducts.length + 1 + (comparedProducts.length < 3 ? 1 : 0)}
                          className="px-4 py-2 font-mono uppercase tracking-wider text-[10px] font-bold text-slate-700"
                        >
                          3. Specifications, Stock &amp; Fulfilment Details
                        </td>
                      </tr>

                      {/* Row: Brand & Department */}
                      <tr>
                        <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          Brand &amp; Department
                        </td>
                        {comparedProducts.map((prod) => (
                          <td
                            key={`brand-${prod.id}`}
                            className="p-3.5 border-r border-slate-200 last:border-r-0"
                          >
                            <span className="font-bold text-slate-900">{prod.brandName}</span>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span className="text-slate-600">{prod.categoryName}</span>
                          </td>
                        ))}
                        {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                      </tr>

                      {/* Row: SKU & Stock Availability */}
                      <tr>
                        <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          SKU &amp; Live Stock Status
                        </td>
                        {comparedProducts.map((prod) => {
                          const selVarId =
                            selectedVariantByProduct[prod.id] || prod.variants?.[0]?.id;
                          const activeVar =
                            prod.variants?.find((v: any) => Number(v.id) === Number(selVarId)) ||
                            prod.variants?.[0];
                          const stock = activeVar?.stockQuantity ?? prod.totalStock ?? 0;
                          return (
                            <td
                              key={`stock-${prod.id}`}
                              className="p-3.5 font-mono-tabular border-r border-slate-200 last:border-r-0"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    stock > 0
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {stock > 0 ? `In Stock (${stock} units)` : 'Out of Stock'}
                                </span>
                                <span className="text-slate-500 text-[11px]">
                                  {activeVar?.sku || prod.sku}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                        {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                      </tr>

                      {/* Dynamic Specification Rows */}
                      {specRows
                        .filter((row) => !highlightDiffsOnly || row.isDifferent)
                        .map((row) => (
                          <tr
                            key={`spec-${row.key}`}
                            className={row.isDifferent && highlightDiffsOnly ? 'bg-amber-50/40' : ''}
                          >
                            <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                              {row.key}
                            </td>
                            {row.values.map((val, idx) => (
                              <td
                                key={`spec-${row.key}-${idx}`}
                                className="p-3.5 text-slate-800 border-r border-slate-200 last:border-r-0"
                              >
                                {val}
                              </td>
                            ))}
                            {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                          </tr>
                        ))}

                      {/* Row: Store Pickup & Shiprocket Delivery */}
                      <tr>
                        <td className="p-3.5 font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          Fulfilment Options
                        </td>
                        {comparedProducts.map((prod) => (
                          <td
                            key={`ful-${prod.id}`}
                            className="p-3.5 border-r border-slate-200 last:border-r-0 space-y-1 text-[11px] text-slate-700"
                          >
                            <div className="flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-[#B42318] shrink-0" />
                              <span>Store Counter Pickup (₹0 Fee · Kanpur)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span>Pan-India Express Home Delivery</span>
                            </div>
                          </td>
                        ))}
                        {comparedProducts.length < 3 && <td className="p-3.5 bg-slate-50/30" />}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
