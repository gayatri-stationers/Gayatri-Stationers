import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Lock,
  Printer,
  ShieldCheck,
  Store,
  Tag,
  Truck,
} from 'lucide-react';
import {
  CartCalculationResult,
  FulfilmentMethod,
  PaymentMethod,
  formatPaiseToINR,
} from '../lib/domain-logic.ts';
import { STORE_ADDRESS, STORE_PHONE } from '../data/defaults.ts';
import { LocalCartItem, getCartItemKey } from '../lib/catalog-helpers.ts';
import { ProductIllustration } from './ProductIllustration.tsx';

interface CheckoutViewProps {
  cartItems: LocalCartItem[];
  products: any[];
  calculation: CartCalculationResult;
  fulfilmentMethod: FulfilmentMethod;
  onSelectFulfilment: (method: FulfilmentMethod) => void;
  paymentMethod: PaymentMethod;
  onSelectPaymentMethod: (method: PaymentMethod) => void;
  customerName: string;
  onChangeCustomerName: (v: string) => void;
  customerPhone: string;
  onChangeCustomerPhone: (v: string) => void;
  customerEmail: string;
  onChangeCustomerEmail: (v: string) => void;
  shippingAddress: string;
  onChangeShippingAddress: (v: string) => void;
  shippingCity: string;
  onChangeShippingCity: (v: string) => void;
  shippingPincode: string;
  onChangeShippingPincode: (v: string) => void;
  pickupWindow: string;
  onChangePickupWindow: (v: string) => void;
  orderNote: string;
  onChangeOrderNote: (v: string) => void;
  gstin: string;
  onChangeGstin: (v: string) => void;
  availableCoupons: any[];
  appliedCouponCode: string;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  submitting: boolean;
  error: string | null;
  pendingOnlineOrder: any | null;
  onRetryOnlinePayment: () => void;
  onSwitchPendingToOffline: () => void;
  onPlaceOrder: (e: React.FormEvent) => void;
  onBackToShop: () => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  cartItems,
  products,
  calculation,
  fulfilmentMethod,
  onSelectFulfilment,
  paymentMethod,
  onSelectPaymentMethod,
  customerName,
  onChangeCustomerName,
  customerPhone,
  onChangeCustomerPhone,
  customerEmail,
  onChangeCustomerEmail,
  shippingAddress,
  onChangeShippingAddress,
  shippingCity,
  onChangeShippingCity,
  shippingPincode,
  onChangeShippingPincode,
  pickupWindow,
  onChangePickupWindow,
  orderNote,
  onChangeOrderNote,
  gstin,
  onChangeGstin,
  availableCoupons,
  appliedCouponCode,
  onApplyCoupon,
  onRemoveCoupon,
  submitting,
  error,
  pendingOnlineOrder,
  onRetryOnlinePayment,
  onSwitchPendingToOffline,
  onPlaceOrder,
  onBackToShop,
}) => {
  const [promoInput, setPromoInput] = useState(appliedCouponCode || '');

  if (cartItems.length === 0 && !pendingOnlineOrder) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="liquid-glass rounded-[32px] p-8 space-y-4">
          <h1 className="text-xl font-bold text-[#1F1C18] font-serif-display">
            Your shopping bag is empty
          </h1>
          <p className="text-xs text-[#5C5349]">
            Add notebooks, pens, or exam kits before proceeding to checkout.
          </p>
          <button
            type="button"
            onClick={onBackToShop}
            className="liquid-btn-primary px-6 py-3 rounded-full text-xs font-bold cursor-pointer"
          >
            Browse Catalogue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToShop}
          className="liquid-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Shop
        </button>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#8C341B]">
          <span className="liquid-glass-subtle px-3 py-1 rounded-full inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> UPI / COD Ready
          </span>
          <span className="liquid-glass-subtle px-3 py-1 rounded-full inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> GST Invoice Included
          </span>
        </div>
      </div>

      {/* Recovery Banner if Cashfree gateway popup was cancelled/failed */}
      {error && (
        <div className="liquid-glass rounded-3xl p-4 sm:p-5 border-[#B44C2E]/45 space-y-3">
          <p className="text-xs sm:text-sm font-bold text-[#1F1C18]">{error}</p>
          {pendingOnlineOrder && (
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={onRetryOnlinePayment}
                className="liquid-btn-primary px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
              >
                Retry UPI / Card Payment
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onSwitchPendingToOffline}
                className="liquid-btn-glass px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
              >
                Switch to {fulfilmentMethod === 'STORE_PICKUP' ? 'Pay at Store Counter' : 'Cash / UPI on Delivery'}
              </button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={onPlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Customer Details, Fulfilment & Payment */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Fulfilment Method */}
          <div className="liquid-glass rounded-[32px] p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
              1. How would you like your order?
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onSelectFulfilment('STORE_PICKUP')}
                className={`rounded-3xl p-4 text-left transition cursor-pointer border ${
                  fulfilmentMethod === 'STORE_PICKUP'
                    ? 'liquid-glass-dark text-white border-[#FCEAE3]/40'
                    : 'liquid-glass-subtle text-[#1F1C18] hover:border-[#D9C7B8]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Store className="w-5 h-5" />
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20">
                    FREE · Ready 2 Hrs
                  </span>
                </div>
                <p className="mt-2.5 text-sm font-bold">Pickup at Kanpur Shop</p>
                <p
                  className={`text-[11px] mt-1 ${
                    fulfilmentMethod === 'STORE_PICKUP' ? 'text-[#FFF5F0]/85' : 'text-[#5C5349]'
                  }`}
                >
                  Awas Vikas Market, Naubasta, Kanpur
                </p>
              </button>

              <button
                type="button"
                onClick={() => onSelectFulfilment('HOME_DELIVERY')}
                className={`rounded-3xl p-4 text-left transition cursor-pointer border ${
                  fulfilmentMethod === 'HOME_DELIVERY'
                    ? 'liquid-glass-dark text-white border-[#FCEAE3]/40'
                    : 'liquid-glass-subtle text-[#1F1C18] hover:border-[#D9C7B8]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Truck className="w-5 h-5" />
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20">
                    Free ≥ ₹599
                  </span>
                </div>
                <p className="mt-2.5 text-sm font-bold">Home / Campus Delivery</p>
                <p
                  className={`text-[11px] mt-1 ${
                    fulfilmentMethod === 'HOME_DELIVERY' ? 'text-[#FFF5F0]/85' : 'text-[#5C5349]'
                  }`}
                >
                  Kanpur local express delivery within 24 hrs
                </p>
              </button>
            </div>

            {fulfilmentMethod === 'STORE_PICKUP' && (
              <div className="liquid-glass-subtle rounded-2xl p-4 space-y-2">
                <label className="block text-xs font-bold text-[#1F1C18]">
                  Preferred Counter Pickup Window
                </label>
                <select
                  value={pickupWindow}
                  onChange={(e) => onChangePickupWindow(e.target.value)}
                  className="liquid-input w-full px-3.5 py-2.5 rounded-2xl text-xs font-semibold"
                >
                  <option value="Today · Within 2 Hours (10 AM – 9 PM)">
                    Today · Within 2 Hours (10 AM – 9 PM)
                  </option>
                  <option value="Today Evening · 5:00 PM – 8:30 PM">
                    Today Evening · 5:00 PM – 8:30 PM
                  </option>
                  <option value="Tomorrow Morning · 10:00 AM – 1:00 PM">
                    Tomorrow Morning · 10:00 AM – 1:00 PM
                  </option>
                </select>
                <p className="text-[11px] text-[#5C5349]">
                  Address: {STORE_ADDRESS} · Call {STORE_PHONE}
                </p>
              </div>
            )}
          </div>

          {/* 2. Customer Contact & Delivery Address */}
          <div className="liquid-glass rounded-[32px] p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
              2. Contact & {fulfilmentMethod === 'STORE_PICKUP' ? 'Billing' : 'Delivery'} Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => onChangeCustomerName(e.target.value)}
                  placeholder="Student / Parent / Buyer Name"
                  className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                  10-Digit Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => onChangeCustomerPhone(e.target.value)}
                  placeholder="9876543210"
                  className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                Email (for invoice & pickup code)
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => onChangeCustomerEmail(e.target.value)}
                placeholder="you@example.com"
                className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
              />
            </div>

            {fulfilmentMethod === 'HOME_DELIVERY' && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                    Full Street / Hostel / House Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={shippingAddress}
                    onChange={(e) => onChangeShippingAddress(e.target.value)}
                    placeholder="House / Flat no., Road, Landmark"
                    className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingCity}
                      onChange={(e) => onChangeShippingCity(e.target.value)}
                      className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                      6-Digit PIN Code *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={shippingPincode}
                      onChange={(e) => onChangeShippingPincode(e.target.value.replace(/\D/g, ''))}
                      placeholder="208021"
                      className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm font-mono-tabular"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <input
                type="text"
                value={orderNote}
                onChange={(e) => onChangeOrderNote(e.target.value)}
                placeholder="Order note (optional)"
                className="liquid-input px-4 py-2.5 rounded-2xl text-xs"
              />
              <input
                type="text"
                value={gstin}
                onChange={(e) => onChangeGstin(e.target.value.toUpperCase())}
                placeholder="GSTIN for Business Invoice (optional)"
                className="liquid-input px-4 py-2.5 rounded-2xl text-xs uppercase font-mono-tabular"
              />
            </div>
          </div>

          {/* 3. Payment Method */}
          <div className="liquid-glass rounded-[32px] p-5 sm:p-6 space-y-3.5">
            <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
              3. Payment Method
            </h2>

            <div className="space-y-2.5">
              {/* Online UPI / Card */}
              <button
                type="button"
                onClick={() => onSelectPaymentMethod('CASHFREE_ONLINE')}
                className={`w-full rounded-2xl p-4 text-left flex items-center justify-between gap-3 transition cursor-pointer border ${
                  paymentMethod === 'CASHFREE_ONLINE'
                    ? 'liquid-glass-dark text-white border-[#FCEAE3]/40'
                    : 'liquid-glass-subtle text-[#1F1C18]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-bold">
                      Pay Online Instantly (UPI, GPay, PhonePe, Cards)
                    </p>
                    <p
                      className={`text-[11px] ${
                        paymentMethod === 'CASHFREE_ONLINE'
                          ? 'text-[#FFF5F0]/85'
                          : 'text-[#5C5349]'
                      }`}
                    >
                      Secured by Cashfree Payments · Zero convenience fee
                    </p>
                  </div>
                </div>
                <ShieldCheck className="w-4 h-4 shrink-0" />
              </button>

              {fulfilmentMethod === 'STORE_PICKUP' ? (
                <button
                  type="button"
                  onClick={() => onSelectPaymentMethod('PAY_AT_STORE')}
                  className={`w-full rounded-2xl p-4 text-left flex items-center justify-between gap-3 transition cursor-pointer border ${
                    paymentMethod === 'PAY_AT_STORE'
                      ? 'liquid-glass-dark text-white border-[#FCEAE3]/40'
                      : 'liquid-glass-subtle text-[#1F1C18]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Store className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold">Pay at Kanpur Shop Counter</p>
                      <p
                        className={`text-[11px] ${
                          paymentMethod === 'PAY_AT_STORE'
                            ? 'text-[#FFF5F0]/85'
                            : 'text-[#5C5349]'
                        }`}
                      >
                        Inspect your items first, then pay Cash or UPI at pickup
                      </p>
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectPaymentMethod('COD')}
                  className={`w-full rounded-2xl p-4 text-left flex items-center justify-between gap-3 transition cursor-pointer border ${
                    paymentMethod === 'COD'
                      ? 'liquid-glass-dark text-white border-[#FCEAE3]/40'
                      : 'liquid-glass-subtle text-[#1F1C18]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold">Cash / UPI on Delivery (COD)</p>
                      <p
                        className={`text-[11px] ${
                          paymentMethod === 'COD' ? 'text-[#FFF5F0]/85' : 'text-[#5C5349]'
                        }`}
                      >
                        Pay Cash or scan delivery partner QR at doorstep
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Order Summary & Promo */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 liquid-glass rounded-[32px] p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">Order Summary</h2>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {cartItems.map((ci) => {
              const prod = products.find((p) => Number(p.id) === Number(ci.productId));
              if (!prod) return null;
              const variant =
                prod.variants?.find((v: any) => Number(v.id) === Number(ci.variantId)) ||
                prod.variants?.[0];
              const price = Number(
                variant?.sellingPricePaise ?? variant?.pricePaise ?? prod.sellingPricePaise ?? 0
              );
              return (
                <div
                  key={getCartItemKey(ci)}
                  className="liquid-glass-subtle rounded-2xl p-2.5 flex items-center gap-3"
                >
                  <div className="w-11 h-11 rounded-xl bg-white/85 overflow-hidden shrink-0">
                    <ProductIllustration
                      type={prod.illustrationType}
                      imageUrl={prod.imageUrl}
                      alt={prod.name}
                      colorTint={ci.selectedColor}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#1F1C18] truncate">{prod.name}</p>
                    <p className="text-[11px] text-[#5C5349]">
                      Qty {ci.quantity}
                      {ci.selectedColor ? ` · ${ci.selectedColor}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#1F1C18] tabular-nums">
                    {formatPaiseToINR(price * ci.quantity, false)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Promo Apply */}
          <div className="liquid-glass-subtle rounded-2xl p-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Coupon code (BACKTOSCHOOL10)"
                className="liquid-input flex-1 px-3 py-2 rounded-full text-xs uppercase font-semibold"
              />
              {appliedCouponCode ? (
                <button
                  type="button"
                  onClick={() => {
                    setPromoInput('');
                    onRemoveCoupon();
                  }}
                  className="liquid-btn-glass px-3.5 py-2 rounded-full text-xs font-bold cursor-pointer"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => promoInput.trim() && onApplyCoupon(promoInput.trim())}
                  className="liquid-btn-primary px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                >
                  Apply
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableCoupons
                .filter((c) => c.isActive !== false)
                .slice(0, 3)
                .map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setPromoInput(c.code);
                      onApplyCoupon(c.code);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/80 border border-[#E8DFD5] text-[10px] font-bold text-[#1F1C18] cursor-pointer"
                  >
                    <Tag className="w-2.5 h-2.5" /> {c.code}
                  </button>
                ))}
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-[#4A423B] pt-1">
            <div className="flex justify-between">
              <span>Items Subtotal</span>
              <span className="font-semibold text-[#1F1C18] tabular-nums">
                {formatPaiseToINR(calculation.subtotalPaise, false)}
              </span>
            </div>
            {calculation.couponDiscountPaise > 0 && (
              <div className="flex justify-between font-semibold text-[#8C341B]">
                <span>Coupon Discount ({appliedCouponCode})</span>
                <span className="tabular-nums">
                  −{formatPaiseToINR(calculation.couponDiscountPaise, false)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{fulfilmentMethod === 'STORE_PICKUP' ? 'Store Pickup' : 'Delivery Charge'}</span>
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
            <div className="flex justify-between text-base font-bold text-[#1F1C18] pt-2.5 border-t border-[#E8DFD5]">
              <span>Total Payable</span>
              <span className="tabular-nums">{formatPaiseToINR(calculation.totalPaise)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full liquid-btn-primary py-3.5 rounded-full text-sm font-bold cursor-pointer"
          >
            {submitting
              ? 'Processing...'
              : paymentMethod === 'CASHFREE_ONLINE'
              ? `Pay ${formatPaiseToINR(calculation.totalPaise)} Securely →`
              : fulfilmentMethod === 'STORE_PICKUP'
              ? 'Reserve for Free Store Pickup →'
              : 'Place Home Delivery Order →'}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ============================================================================
   6. ORDER CONFIRMATION VIEW
   ============================================================================ */
interface ConfirmationViewProps {
  orderData: any;
  onTrackOrder: () => void;
  onContinueShopping: () => void;
  onCompleteOnlinePayment?: () => void;
  completingPayment?: boolean;
}

export const ConfirmationView: React.FC<ConfirmationViewProps> = ({
  orderData,
  onTrackOrder,
  onContinueShopping,
  onCompleteOnlinePayment,
  completingPayment = false,
}) => {
  const ord = orderData?.order || {};
  const pickupCode = orderData?.pickupDetails?.pickupCode;
  const needsOnlinePayment =
    ord.paymentMethod === 'CASHFREE_ONLINE' && ord.paymentStatus !== 'PAID';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="liquid-glass rounded-[36px] p-6 sm:p-9 space-y-6 text-center">
        <div className="w-16 h-16 rounded-3xl liquid-btn-primary flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>

        <div className="space-y-1.5">
          <span className="inline-block px-3 py-1 rounded-full bg-[#FDF2ED] text-[#1F1C18] text-[11px] font-bold uppercase tracking-wider">
            {ord.paymentStatus === 'PAID'
              ? 'Payment Received · Confirmed'
              : needsOnlinePayment
              ? 'Order Saved · Awaiting Online Payment'
              : 'Order Confirmed'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1F1C18] font-serif-display">
            Thank you, {ord.customerName || 'Valued Customer'}!
          </h1>
          <p className="text-xs text-[#5C5349]">
            Order Number: <span className="font-mono-tabular font-bold">{ord.orderNumber}</span>
          </p>
        </div>

        {pickupCode && (
          <div className="liquid-glass-dark text-white rounded-3xl p-5 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-[#FCEAE3] font-semibold inline-flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" /> 6-Digit Kanpur Shop Pickup Code
            </p>
            <p className="text-3xl sm:text-4xl font-bold font-mono-tabular tracking-[0.25em]">
              {pickupCode}
            </p>
            <p className="text-xs text-[#FFF5F0]/85">Show this code at {STORE_ADDRESS}</p>
          </div>
        )}

        <div className="liquid-glass-subtle rounded-2xl p-4 text-left space-y-2 text-xs">
          <div className="flex justify-between font-bold text-[#1F1C18]">
            <span>Total Paid / Payable</span>
            <span className="tabular-nums">{formatPaiseToINR(ord.totalPaise)}</span>
          </div>
          <div className="flex justify-between text-[#5C5349]">
            <span>Payment Status</span>
            <span className="font-semibold text-[#1F1C18]">{ord.paymentStatus}</span>
          </div>
          <div className="flex justify-between text-[#5C5349]">
            <span>Fulfilment</span>
            <span className="font-semibold text-[#1F1C18]">
              {ord.fulfilmentMethod === 'STORE_PICKUP' ? 'Kanpur Store Pickup' : 'Home Delivery'}
            </span>
          </div>
        </div>

        {needsOnlinePayment && onCompleteOnlinePayment && (
          <div className="liquid-glass-dark text-white rounded-3xl p-4 space-y-2.5">
            <p className="text-xs text-[#FFF5F0]/90">
              Complete your UPI, GPay, PhonePe, or Card payment using Cashfree Gateway.
            </p>
            <button
              type="button"
              disabled={completingPayment}
              onClick={onCompleteOnlinePayment}
              className="px-6 py-2.5 rounded-full bg-white text-[#1F1C18] text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {completingPayment ? 'Opening Cashfree...' : 'Pay Now via Cashfree Gateway →'}
            </button>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="liquid-btn-glass px-4 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print Receipt
          </button>
          <button
            type="button"
            onClick={onTrackOrder}
            className="liquid-btn-glass px-4 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
          >
            Track Order Status
          </button>
          <button
            type="button"
            onClick={onContinueShopping}
            className="liquid-btn-primary px-6 py-2.5 rounded-full text-xs font-bold cursor-pointer"
          >
            Continue Shopping →
          </button>
        </div>
      </div>
    </div>
  );
};
