import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bookmark,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  CartCalculationResult,
  FulfilmentMethod,
  formatPaiseToINR,
} from '../lib/domain-logic.ts';
import { LocalCartItem, getCartItemKey } from '../lib/catalog-helpers.ts';
import { ProductIllustration } from './ProductIllustration.tsx';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: LocalCartItem[];
  products: any[];
  calculation: CartCalculationResult;
  fulfilmentMethod: FulfilmentMethod;
  onChangeFulfilmentMethod: (method: FulfilmentMethod) => void;
  availableCoupons: any[];
  appliedCouponCode: string;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  couponMessage?: string;
  orderNote: string;
  onChangeOrderNote: (note: string) => void;
  onUpdateQuantity: (
    productId: number,
    variantId: number,
    selectedColor: string | undefined,
    delta: number
  ) => void;
  onRemoveItem: (
    productId: number,
    variantId: number,
    selectedColor: string | undefined
  ) => void;
  onSaveToWishlist: (product: any, variantId: number, selectedColor?: string) => void;
  onClearBag: () => void;
  onQuickAddProduct: (product: any) => void;
  onProceedToCheckout: () => void;
  onOpenProduct: (slug: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  products,
  calculation,
  fulfilmentMethod,
  onChangeFulfilmentMethod,
  availableCoupons,
  appliedCouponCode,
  onApplyCoupon,
  onRemoveCoupon,
  couponMessage,
  orderNote,
  onChangeOrderNote,
  onUpdateQuantity,
  onRemoveItem,
  onSaveToWishlist,
  onClearBag,
  onQuickAddProduct,
  onProceedToCheckout,
  onOpenProduct,
}) => {
  const [promoDraft, setPromoDraft] = useState(appliedCouponCode || '');
  const [showNoteBox, setShowNoteBox] = useState(Boolean(orderNote));

  const totalCount = useMemo(
    () => cartItems.reduce((sum, ci) => sum + Number(ci.quantity || 1), 0),
    [cartItems]
  );

  // Suggest up to 3 in-stock accessories/bestsellers not already in the bag
  const upsellSuggestions = useMemo(() => {
    const inBagIds = new Set(cartItems.map((c) => Number(c.productId)));
    return products
      .filter(
        (p) =>
          !inBagIds.has(Number(p.id)) &&
          p.isActive !== false &&
          Number(p.totalStock ?? p.variants?.[0]?.stockQuantity ?? 0) > 0
      )
      .slice(0, 4);
  }, [cartItems, products]);

  // Progress bar target: Free Local Delivery (₹599) or STORE50 coupon (₹399)
  const targetThresholdPaise = fulfilmentMethod === 'HOME_DELIVERY' ? 59900 : 39900;
  const remainingPaise = Math.max(0, targetThresholdPaise - Number(calculation.subtotalPaise || 0));
  const progressPercent = Math.min(
    100,
    Math.round((Number(calculation.subtotalPaise || 0) / targetThresholdPaise) * 100)
  );

  const handlePromoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = promoDraft.trim().toUpperCase();
    if (!clean) return;
    onApplyCoupon(clean);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Frosted Indigo Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#1F1C18]/35 backdrop-blur-sm"
          />

          {/* Liquid Glass Drawer Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative z-10 w-full max-w-md h-full liquid-glass border-l border-white/90 flex flex-col overflow-hidden"
            aria-label="Shopping Bag"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E8DFD5] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full liquid-btn-primary flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1F1C18] font-serif-display leading-tight">
                    Your Bag ({totalCount})
                  </h2>
                  <p className="text-[11px] text-[#5C5349]">
                    Kanpur Same-Day Pickup & Delivery
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearBag}
                    className="liquid-btn-glass px-3 py-1.5 rounded-full text-[11px] font-semibold text-[#8C341B] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close bag"
                  className="liquid-btn-glass p-2 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4 text-[#1F1C18]" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {cartItems.length === 0 ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl liquid-glass-subtle flex items-center justify-center mx-auto">
                    <ShoppingBag className="w-7 h-7 text-[#B44C2E]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1F1C18]">Your stationery bag is empty</h3>
                    <p className="text-xs text-[#5C5349] mt-1 max-w-xs mx-auto">
                      Add notebooks, gel pens, geometry boxes, or art kits and apply code{' '}
                      <span className="font-mono-tabular font-bold text-[#8C341B]">
                        BACKTOSCHOOL10
                      </span>
                      .
                    </p>
                  </div>

                  {upsellSuggestions.length > 0 && (
                    <div className="pt-4 text-left space-y-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#5C5349]">
                        Popular Picks to Start
                      </p>
                      {upsellSuggestions.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="liquid-glass-subtle rounded-2xl p-3 flex items-center gap-3"
                        >
                          <div className="w-12 h-12 rounded-xl bg-white/80 overflow-hidden shrink-0">
                            <ProductIllustration
                              type={item.illustrationType}
                              imageUrl={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#1F1C18] truncate">{item.name}</p>
                            <p className="text-xs font-semibold text-[#B44C2E]">
                              {formatPaiseToINR(item.sellingPricePaise, false)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onQuickAddProduct(item)}
                            className="liquid-btn-primary px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Store Pickup vs Home Delivery Switcher */}
                  <div className="liquid-glass-subtle p-1 rounded-full grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => onChangeFulfilmentMethod('STORE_PICKUP')}
                      className={`py-2 px-3 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        fulfilmentMethod === 'STORE_PICKUP'
                          ? 'liquid-btn-primary text-white shadow-sm'
                          : 'text-[#4A423B] hover:text-[#1F1C18]'
                      }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      Store Pickup (Free)
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeFulfilmentMethod('HOME_DELIVERY')}
                      className={`py-2 px-3 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        fulfilmentMethod === 'HOME_DELIVERY'
                          ? 'liquid-btn-primary text-white shadow-sm'
                          : 'text-[#4A423B] hover:text-[#1F1C18]'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      Home Delivery
                    </button>
                  </div>

                  {/* Savings & Delivery Progress Bar */}
                  <div className="liquid-glass-subtle rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#1F1C18]">
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#B44C2E]" />
                        {remainingPaise === 0
                          ? fulfilmentMethod === 'HOME_DELIVERY'
                            ? 'Free Kanpur Delivery Unlocked!'
                            : '₹50 OFF Store Voucher (STORE50) Ready!'
                          : fulfilmentMethod === 'HOME_DELIVERY'
                          ? `Add ${formatPaiseToINR(remainingPaise, false)} for Free Home Delivery`
                          : `Add ${formatPaiseToINR(remainingPaise, false)} to unlock ₹50 OFF (STORE50)`}
                      </span>
                      <span className="text-[11px] font-mono-tabular text-[#B44C2E]">
                        {progressPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#FDF2ED] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#C95939] to-[#8C341B] transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Cart Line Items */}
                  <div className="space-y-3">
                    {cartItems.map((ci) => {
                      const prod = products.find((p) => Number(p.id) === Number(ci.productId));
                      if (!prod) return null;
                      const variant =
                        prod.variants?.find((v: any) => Number(v.id) === Number(ci.variantId)) ||
                        prod.variants?.[0];
                      const unitPrice = Number(
                        variant?.sellingPricePaise ?? variant?.pricePaise ?? prod.sellingPricePaise ?? 0
                      );
                      const unitMrp = Number(variant?.mrpPaise ?? prod.mrpPaise ?? unitPrice);
                      const lineTotal = unitPrice * ci.quantity;
                      const key = getCartItemKey(ci);

                      return (
                        <div
                          key={key}
                          className="liquid-glass-subtle rounded-2xl p-3.5 flex gap-3 transition"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenProduct(prod.slug);
                            }}
                            className="w-16 h-16 rounded-2xl bg-white/85 overflow-hidden shrink-0 cursor-pointer"
                          >
                            <ProductIllustration
                              type={prod.illustrationType}
                              imageUrl={prod.imageUrl}
                              alt={prod.name}
                              colorTint={ci.selectedColor}
                              className="w-full h-full object-cover"
                            />
                          </button>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenProduct(prod.slug);
                                }}
                                className="text-xs font-bold text-[#1F1C18] text-left hover:underline line-clamp-2 cursor-pointer"
                              >
                                {prod.name}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onRemoveItem(ci.productId, ci.variantId, ci.selectedColor)
                                }
                                className="text-[#8B8075] hover:text-[#1F1C18] p-1 cursor-pointer shrink-0"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#5C5349]">
                              <span>{variant?.variantName || 'Standard Pack'}</span>
                              {ci.selectedColor && (
                                <span className="px-2 py-0.5 rounded-full bg-[#FDF2ED] text-[#1F1C18] font-semibold">
                                  {ci.selectedColor}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <div className="inline-flex items-center liquid-btn-glass rounded-full px-1 py-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateQuantity(
                                      ci.productId,
                                      ci.variantId,
                                      ci.selectedColor,
                                      -1
                                    )
                                  }
                                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-[#FDF2ED] cursor-pointer"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="px-2.5 text-xs font-bold tabular-nums text-[#1F1C18]">
                                  {ci.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateQuantity(
                                      ci.productId,
                                      ci.variantId,
                                      ci.selectedColor,
                                      1
                                    )
                                  }
                                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-[#FDF2ED] cursor-pointer"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="text-right">
                                <span className="text-xs font-bold text-[#1F1C18] tabular-nums">
                                  {formatPaiseToINR(lineTotal, false)}
                                </span>
                                {unitMrp > unitPrice && (
                                  <span className="ml-1.5 text-[10px] line-through text-[#8B8075] tabular-nums">
                                    {formatPaiseToINR(unitMrp * ci.quantity, false)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                onSaveToWishlist(prod, ci.variantId, ci.selectedColor)
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B44C2E] hover:underline cursor-pointer"
                            >
                              <Bookmark className="w-3 h-3" />
                              Save for later
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Promo / Coupon Box Inside Cart Drawer */}
                  <div className="liquid-glass-subtle rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1F1C18] inline-flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#B44C2E]" />
                        Promo & Student Coupons
                      </span>
                      {appliedCouponCode && (
                        <button
                          type="button"
                          onClick={() => {
                            setPromoDraft('');
                            onRemoveCoupon();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1F1C18] text-white text-[10px] font-bold cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          {appliedCouponCode} ×
                        </button>
                      )}
                    </div>

                    <form onSubmit={handlePromoSubmit} className="flex gap-2">
                      <input
                        type="text"
                        value={promoDraft}
                        onChange={(e) => setPromoDraft(e.target.value.toUpperCase())}
                        placeholder="Enter coupon code"
                        className="liquid-input flex-1 px-3 py-2 rounded-full text-xs uppercase font-semibold"
                      />
                      <button
                        type="submit"
                        className="liquid-btn-primary px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                      >
                        Apply
                      </button>
                    </form>

                    {/* 1-Tap Coupon Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {availableCoupons
                        .filter((c) => c.isActive !== false)
                        .slice(0, 3)
                        .map((c) => {
                          const isApplied = appliedCouponCode === c.code;
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setPromoDraft(c.code);
                                onApplyCoupon(c.code);
                              }}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                                isApplied
                                  ? 'bg-[#1F1C18] text-white'
                                  : 'bg-white/80 border border-[#E8DFD5] text-[#8C341B] hover:bg-[#FDF2ED]'
                              }`}
                            >
                              {c.code} (
                              {c.discountType === 'PERCENTAGE'
                                ? `${c.discountValue}%`
                                : `₹${Math.round(c.discountValue / 100)}`}{' '}
                              OFF)
                            </button>
                          );
                        })}
                    </div>

                    {couponMessage && (
                      <p className="text-[11px] font-medium text-[#B44C2E]">{couponMessage}</p>
                    )}
                  </div>

                  {/* Optional Order / Packing Note */}
                  <div className="liquid-glass-subtle rounded-2xl p-3">
                    {!showNoteBox ? (
                      <button
                        type="button"
                        onClick={() => setShowNoteBox(true)}
                        className="text-xs font-semibold text-[#8C341B] hover:underline cursor-pointer"
                      >
                        + Add packing note or gift instructions (optional)
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-[#1F1C18] block">
                          Order / Gift Packing Note
                        </label>
                        <input
                          type="text"
                          value={orderNote}
                          onChange={(e) => onChangeOrderNote(e.target.value)}
                          placeholder="e.g. Pack notebooks with extra bubble wrap / gift wrap"
                          className="liquid-input w-full px-3 py-2 rounded-xl text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Upsell Strip: Complete Your Stationery Kit */}
                  {upsellSuggestions.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#5C5349]">
                        Add with 1 Tap
                      </p>
                      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                        {upsellSuggestions.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className="liquid-glass-subtle rounded-2xl p-2.5 w-44 shrink-0 flex flex-col justify-between gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-xl bg-white/85 overflow-hidden shrink-0">
                                <ProductIllustration
                                  type={item.illustrationType}
                                  imageUrl={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-[#1F1C18] truncate">
                                  {item.name}
                                </p>
                                <p className="text-[11px] font-semibold text-[#B44C2E]">
                                  {formatPaiseToINR(item.sellingPricePaise, false)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onQuickAddProduct(item)}
                              className="w-full liquid-btn-glass py-1.5 rounded-full text-[11px] font-semibold cursor-pointer"
                            >
                              + Add to Bag
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Totals + Checkout Button */}
            {cartItems.length > 0 && (
              <div className="px-5 py-4 border-t border-[#E8DFD5] bg-white/60 backdrop-blur-xl space-y-3">
                <div className="space-y-1.5 text-xs text-[#4A423B]">
                  <div className="flex justify-between">
                    <span>Items Subtotal ({totalCount})</span>
                    <span className="font-semibold tabular-nums text-[#1F1C18]">
                      {formatPaiseToINR(calculation.subtotalPaise, false)}
                    </span>
                  </div>
                  {calculation.catalogSavingsPaise > 0 && (
                    <div className="flex justify-between text-[#B44C2E] font-semibold">
                      <span>MRP Savings</span>
                      <span className="tabular-nums">
                        −{formatPaiseToINR(calculation.catalogSavingsPaise, false)}
                      </span>
                    </div>
                  )}
                  {calculation.couponDiscountPaise > 0 && (
                    <div className="flex justify-between text-[#8C341B] font-semibold">
                      <span>Promo Discount ({appliedCouponCode})</span>
                      <span className="tabular-nums">
                        −{formatPaiseToINR(calculation.couponDiscountPaise, false)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>
                      {fulfilmentMethod === 'STORE_PICKUP' ? 'Kanpur Store Pickup' : 'Delivery Fee'}
                    </span>
                    <span className="font-semibold text-[#1F1C18]">
                      {calculation.shippingPaise === 0
                        ? 'FREE'
                        : formatPaiseToINR(calculation.shippingPaise, false)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#5C5349]">
                    <span>Included GST</span>
                    <span className="tabular-nums">{formatPaiseToINR(calculation.taxPaise)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#1F1C18] pt-2 border-t border-[#E8DFD5]">
                    <span>Total Payable</span>
                    <span className="tabular-nums">{formatPaiseToINR(calculation.totalPaise)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="liquid-btn-glass py-3 rounded-full text-xs font-semibold cursor-pointer"
                  >
                    Keep Shopping
                  </button>
                  <button
                    type="button"
                    onClick={onProceedToCheckout}
                    className="liquid-btn-primary py-3 rounded-full text-xs font-bold cursor-pointer"
                  >
                    Checkout →
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
