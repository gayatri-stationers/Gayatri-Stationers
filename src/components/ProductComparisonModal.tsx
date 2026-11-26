import React, { useState, useMemo } from 'react';
import {
  X,
  Scale,
  ShoppingBag,
  Trash2,
  Plus,
  Store,
  Truck,
  Search,
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

function buildProductSpecificationsMap(product: any, activeVariant: any): Record<string, string> {
  const explicitSpecs: Record<string, any> =
    product?.specifications && typeof product.specifications === 'object'
      ? product.specifications
      : {};
  const nameLower = `${product?.name || ''} ${product?.shortDescription || ''}`.toLowerCase();
  const catLower = `${product?.categoryName || ''}`.toLowerCase();
  const derived: Record<string, string> = {};

  for (const [k, v] of Object.entries(explicitSpecs)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      derived[k] = String(v);
    }
  }

  if (catLower.includes('notebook') || nameLower.includes('pages')) {
    if (!derived['Paper GSM']) derived['Paper GSM'] = '70 GSM Bright White';
    if (!derived['Binding']) {
      derived['Binding'] = nameLower.includes('spiral') ? 'Twin-Wire Spiral' : 'Section-Sewn Hardbound';
    }
  } else if (catLower.includes('pen') || catLower.includes('writing')) {
    if (!derived['Tip Size']) {
      const tipMatch = nameLower.match(/(0\.\d+)\s*mm/i);
      derived['Tip Size'] = tipMatch ? `${tipMatch[1]} mm Fine Tip` : '0.7 mm Precision Tip';
    }
    if (!derived['Ink System']) {
      derived['Ink System'] = nameLower.includes('gel') ? 'Waterproof Gel Ink' : 'Low-Viscosity Smooth Ink';
    }
  }
  if (!derived['Pack Specification']) {
    derived['Pack Specification'] = activeVariant?.variantName || 'Standard Retail Pack';
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
          String(p.categoryName || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [products, compareProductIds, addSlotSearch]);

  const lowestPricePaise = useMemo(() => {
    if (comparedProducts.length < 2) return null;
    const prices = comparedProducts.map((p) => {
      const selVarId = selectedVariantByProduct[p.id] || p.variants?.[0]?.id;
      const v =
        p.variants?.find((item: any) => Number(item.id) === Number(selVarId)) || p.variants?.[0];
      return Number(v?.sellingPricePaise ?? p.sellingPricePaise ?? 0);
    });
    return Math.min(...prices.filter((n) => n > 0));
  }, [comparedProducts, selectedVariantByProduct]);

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
      return { key, values, isDifferent: comparedProducts.length > 1 && new Set(values).size > 1 };
    });
  }, [comparedProducts, selectedVariantByProduct]);

  return (
    <>
      {compareToastMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-sm liquid-glass-dark text-white px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#FCEAE3] shrink-0" />
            <span>{compareToastMessage}</span>
          </div>
          {onDismissToast && (
            <button
              type="button"
              onClick={onDismissToast}
              className="text-[#FCEAE3] hover:text-white underline text-[11px] shrink-0 cursor-pointer"
            >
              OK
            </button>
          )}
        </div>
      )}

      {comparedProducts.length > 0 && !isOpen && (
        <div className="fixed bottom-20 md:bottom-5 left-3 right-3 md:left-auto md:right-6 md:max-w-3xl z-40 liquid-glass-dark text-white rounded-[28px] p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5">
              <div className="flex items-center gap-2 pr-2.5 border-r border-white/15 shrink-0">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <Scale className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[#FCEAE3] font-bold">
                    COMPARE
                  </p>
                  <p className="text-xs font-bold font-mono-tabular">
                    {comparedProducts.length}/3 Selected
                  </p>
                </div>
              </div>

              {comparedProducts.map((prod) => {
                const v =
                  prod.variants?.find(
                    (item: any) => Number(item.id) === Number(selectedVariantByProduct[prod.id])
                  ) || prod.variants?.[0];
                const price = v?.sellingPricePaise ?? prod.sellingPricePaise ?? 0;
                return (
                  <div
                    key={`tray-cmp-${prod.id}`}
                    className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 bg-white/10 border border-white/15 rounded-2xl shrink-0 max-w-[190px]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white overflow-hidden shrink-0">
                      <ProductIllustration
                        type={prod.illustrationType}
                        imageUrl={prod.imageUrl}
                        alt={prod.name}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-white truncate">{prod.name}</p>
                      <p className="text-[10px] font-mono-tabular text-[#FCEAE3] font-bold">
                        {formatPaiseToINR(price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleCompare(Number(prod.id))}
                      aria-label={`Remove ${prod.name}`}
                      className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClearCompare}
                className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-[#FFF5F0] text-xs font-medium cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onOpenModal}
                className="px-4 py-2 rounded-full bg-white text-[#1F1C18] hover:bg-[#FDF2ED] text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Compare ({comparedProducts.length}/3)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#1F1C18]/50 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Side-by-Side Product Comparison"
        >
          <div className="liquid-glass rounded-[32px] w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 sm:px-7 py-4 liquid-glass-dark text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-serif-display text-lg sm:text-xl font-bold tracking-tight">
                    Side-by-Side Stationery Comparison ({comparedProducts.length}/3)
                  </h2>
                  <p className="text-xs text-[#FCEAE3]">
                    Compare specifications, INR pricing, pack options, and swatches side-by-side
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {comparedProducts.length >= 2 && (
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={highlightDiffsOnly}
                      onChange={(e) => setHighlightDiffsOnly(e.target.checked)}
                    />
                    <span>Differences Only</span>
                  </label>
                )}
                {comparedProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearCompare}
                    className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close comparison"
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6">
              {comparedProducts.length === 0 ? (
                <div className="max-w-2xl mx-auto my-6 liquid-glass-subtle rounded-[28px] p-6 sm:p-8 text-center space-y-5">
                  <div className="w-14 h-14 rounded-full bg-[#FDF2ED] text-[#B44C2E] flex items-center justify-center mx-auto">
                    <Scale className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-serif-display text-xl font-bold text-[#1F1C18]">
                      Select Up to 3 Items to Compare
                    </h3>
                    <p className="text-xs text-[#5C5349]">
                      Choose products below or tap <strong>+ Compare</strong> on any product card.
                    </p>
                  </div>
                  <div className="max-w-md mx-auto">
                    <div className="flex items-center px-3.5 py-2 liquid-input rounded-full">
                      <Search className="w-4 h-4 text-[#B44C2E] shrink-0" />
                      <input
                        type="text"
                        value={addSlotSearch}
                        onChange={(e) => setAddSlotSearch(e.target.value)}
                        placeholder="Search stationery items..."
                        className="w-full px-2.5 text-xs bg-transparent focus:outline-none text-[#1F1C18]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    {availableToAddProducts.slice(0, 6).map((p) => (
                      <button
                        key={`empty-pick-${p.id}`}
                        type="button"
                        onClick={() => onToggleCompare(Number(p.id))}
                        className="p-3 rounded-2xl liquid-glass hover:border-[#B44C2E]/45 flex items-center justify-between gap-3 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-11 rounded-xl border border-[#E8DFD5] bg-white overflow-hidden shrink-0">
                            <ProductIllustration
                              type={p.illustrationType}
                              imageUrl={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1F1C18] truncate">{p.name}</p>
                            <p className="text-[10px] text-[#5C5349] font-mono-tabular">
                              {p.brandName} · {formatPaiseToINR(p.sellingPricePaise)}
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 liquid-btn-primary text-[10px] font-bold rounded-full shrink-0">
                          + Select
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="liquid-glass-subtle rounded-[24px] overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E8DFD5] bg-[#FAF8F5]/80">
                        <th className="w-44 sm:w-52 p-4 align-top font-mono uppercase tracking-wider text-[11px] text-[#5C5349] font-bold border-r border-[#E8DFD5]/40">
                          Comparison
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
                            selectedColorByProduct[prod.id] || getProductColorOptions(prod)[0]?.label;

                          return (
                            <th
                              key={`cmp-col-${prod.id}`}
                              className="w-60 sm:w-64 p-4 align-top border-r border-[#E8DFD5]/40 last:border-r-0 font-normal"
                            >
                              <div className="space-y-3">
                                <div className="relative aspect-4/3 rounded-2xl border border-[#E8DFD5] bg-white overflow-hidden">
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
                                      className="w-full h-full"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onToggleCompare(Number(prod.id))}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 hover:bg-[#B44C2E] text-[#1F1C18] hover:text-white border border-[#E8DFD5] flex items-center justify-center cursor-pointer transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                  {lowestPricePaise !== null && price === lowestPricePaise && (
                                    <span className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full bg-[#B44C2E] text-white text-[10px] font-mono uppercase font-bold">
                                      Best Value
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[10px] font-mono uppercase text-[#B44C2E] font-bold">
                                    {prod.brandName} · {prod.categoryName}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onOpenProduct(prod);
                                    }}
                                    className="font-bold text-sm text-[#1F1C18] hover:underline text-left line-clamp-2 cursor-pointer"
                                  >
                                    {prod.name}
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={stock <= 0}
                                    onClick={() => {
                                      onClose();
                                      onAddToCart(prod, activeVar?.id, activeColor);
                                    }}
                                    className="flex-1 py-2 px-3 liquid-btn-primary disabled:opacity-40 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                    <span>{stock > 0 ? formatPaiseToINR(price) : 'Out'}</span>
                                  </button>
                                </div>
                              </div>
                            </th>
                          );
                        })}
                        {comparedProducts.length < 3 && (
                          <th className="w-56 p-4 align-top font-normal">
                            <p className="text-xs font-bold text-[#1F1C18] mb-2">
                              Add Item ({comparedProducts.length + 1}/3)
                            </p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {availableToAddProducts.slice(0, 4).map((cand) => (
                                <button
                                  key={`slot-add-${cand.id}`}
                                  type="button"
                                  onClick={() => onToggleCompare(Number(cand.id))}
                                  className="w-full p-2 rounded-xl bg-white/80 hover:bg-white border border-[#E8DFD5] flex items-center justify-between gap-2 text-left cursor-pointer"
                                >
                                  <span className="text-[11px] font-semibold text-[#1F1C18] truncate">
                                    {cand.name}
                                  </span>
                                  <Plus className="w-3.5 h-3.5 text-[#B44C2E] shrink-0" />
                                </button>
                              ))}
                            </div>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8DFD5]/60">
                      <tr>
                        <td className="p-3.5 font-semibold text-[#1F1C18] bg-[#FDF2ED]/30 border-r border-[#E8DFD5]/40">
                          Price (Incl. GST)
                        </td>
                        {comparedProducts.map((prod) => {
                          const v =
                            prod.variants?.find(
                              (x: any) => Number(x.id) === Number(selectedVariantByProduct[prod.id])
                            ) || prod.variants?.[0];
                          const price = v?.sellingPricePaise ?? prod.sellingPricePaise ?? 0;
                          return (
                            <td
                              key={`p-${prod.id}`}
                              className="p-3.5 font-mono-tabular font-bold text-sm text-[#1F1C18] border-r border-[#E8DFD5]/40 last:border-r-0"
                            >
                              {formatPaiseToINR(price)}
                            </td>
                          );
                        })}
                        {comparedProducts.length < 3 && <td />}
                      </tr>
                      <tr>
                        <td className="p-3.5 font-semibold text-[#1F1C18] bg-[#FDF2ED]/30 border-r border-[#E8DFD5]/40">
                          Pack Variant
                        </td>
                        {comparedProducts.map((prod) => {
                          const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
                          const selVarId = selectedVariantByProduct[prod.id] || variants[0]?.id;
                          return (
                            <td
                              key={`v-${prod.id}`}
                              className="p-3.5 border-r border-[#E8DFD5]/40 last:border-r-0"
                            >
                              {variants.length > 1 ? (
                                <select
                                  value={selVarId}
                                  onChange={(e) => onSelectVariant(prod.id, Number(e.target.value))}
                                  className="w-full px-2.5 py-1.5 text-xs liquid-input rounded-full font-medium"
                                >
                                  {variants.map((v: any) => (
                                    <option key={v.id} value={v.id}>
                                      {v.variantName}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-[#4A423B]">
                                  {variants[0]?.variantName || 'Standard'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        {comparedProducts.length < 3 && <td />}
                      </tr>
                      <tr>
                        <td className="p-3.5 font-semibold text-[#1F1C18] bg-[#FDF2ED]/30 border-r border-[#E8DFD5]/40">
                          Colour Swatches
                        </td>
                        {comparedProducts.map((prod) => {
                          const colors = getProductColorOptions(prod);
                          const activeColor = selectedColorByProduct[prod.id] || colors[0]?.label;
                          return (
                            <td
                              key={`col-${prod.id}`}
                              className="p-3.5 border-r border-[#E8DFD5]/40 last:border-r-0"
                            >
                              {colors.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {colors.map((c) => (
                                    <button
                                      key={c.label}
                                      type="button"
                                      onClick={() => onSelectColor(prod.id, c.label, c.variantId)}
                                      className={`px-2 py-1 rounded-full border text-[11px] flex items-center gap-1 cursor-pointer ${
                                        activeColor === c.label
                                          ? 'bg-[#B44C2E] text-white border-[#B44C2E]'
                                          : 'bg-white text-[#1F1C18] border-[#E8DFD5]'
                                      }`}
                                    >
                                      <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ background: c.swatch, border: `1px solid ${c.border}` }}
                                      />
                                      <span>{c.shortLabel}</span>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[#5C5349]">Standard Edition</span>
                              )}
                            </td>
                          );
                        })}
                        {comparedProducts.length < 3 && <td />}
                      </tr>
                      {specRows
                        .filter((r) => !highlightDiffsOnly || r.isDifferent)
                        .map((row) => (
                          <tr key={row.key}>
                            <td className="p-3.5 font-semibold text-[#1F1C18] bg-[#FDF2ED]/30 border-r border-[#E8DFD5]/40">
                              {row.key}
                            </td>
                            {row.values.map((val, idx) => (
                              <td
                                key={`${row.key}-${idx}`}
                                className="p-3.5 text-[#4A423B] border-r border-[#E8DFD5]/40 last:border-r-0"
                              >
                                {val}
                              </td>
                            ))}
                            {comparedProducts.length < 3 && <td />}
                          </tr>
                        ))}
                      <tr>
                        <td className="p-3.5 font-semibold text-[#1F1C18] bg-[#FDF2ED]/30 border-r border-[#E8DFD5]/40">
                          Fulfilment
                        </td>
                        {comparedProducts.map((prod) => (
                          <td
                            key={`f-${prod.id}`}
                            className="p-3.5 text-[11px] text-[#4A423B] border-r border-[#E8DFD5]/40 last:border-r-0 space-y-1"
                          >
                            <div className="flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-[#B44C2E]" />
                              <span>Store Pickup (₹0 Fee)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-[#B44C2E]" />
                              <span>Home Delivery Available</span>
                            </div>
                          </td>
                        ))}
                        {comparedProducts.length < 3 && <td />}
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
