import React, { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  User,
} from 'lucide-react';
import { formatPaiseToINR } from '../lib/domain-logic.ts';
import {
  OWNER_EMAIL,
  STORE_ADDRESS,
  STORE_EMAIL,
  STORE_PHONE,
} from '../data/defaults.ts';
import { OrderTrackingTimeline } from './OrderTrackingTimeline.tsx';
import { ProductIllustration } from './ProductIllustration.tsx';

/* ============================================================================
   1. CUSTOMER SIGN IN & CREATE ACCOUNT VIEW
   ============================================================================ */
interface SignInViewProps {
  authMode: 'signin' | 'signup';
  onChangeAuthMode: (mode: 'signin' | 'signup') => void;
  email: string;
  onChangeEmail: (v: string) => void;
  fullName: string;
  onChangeFullName: (v: string) => void;
  phone: string;
  onChangePhone: (v: string) => void;
  password: string;
  onChangePassword: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onGoogleSignIn: () => void;
  onEmailAuthSubmit: (e: React.FormEvent) => void;
  onOpenAdminLogin: () => void;
  onBackHome: () => void;
}

export const SignInView: React.FC<SignInViewProps> = ({
  authMode,
  onChangeAuthMode,
  email,
  onChangeEmail,
  fullName,
  onChangeFullName,
  phone,
  onChangePhone,
  password,
  onChangePassword,
  submitting,
  error,
  onGoogleSignIn,
  onEmailAuthSubmit,
  onOpenAdminLogin,
  onBackHome,
}) => {
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
      <button
        type="button"
        onClick={onBackHome}
        className="liquid-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold mb-5 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Shop
      </button>

      <div className="liquid-glass rounded-[32px] p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl liquid-btn-primary flex items-center justify-center mx-auto">
            <User className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1F1C18] font-serif-display">
            {authMode === 'signin' ? 'Welcome Back' : 'Create Student / Shop Account'}
          </h1>
          <p className="text-xs text-[#5C5349]">
            Track Kanpur store pickups, save delivery addresses, and reorder notebooks in 1 tap.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="liquid-glass-subtle p-1 rounded-full grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => onChangeAuthMode('signin')}
            className={`py-2 rounded-full text-xs font-semibold cursor-pointer ${
              authMode === 'signin' ? 'liquid-btn-primary text-white' : 'text-[#8C341B]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onChangeAuthMode('signup')}
            className={`py-2 rounded-full text-xs font-semibold cursor-pointer ${
              authMode === 'signup' ? 'liquid-btn-primary text-white' : 'text-[#8C341B]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Google One-Tap Sign In */}
        <button
          type="button"
          disabled={submitting}
          onClick={onGoogleSignIn}
          className="w-full liquid-btn-glass py-3 px-4 rounded-full text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 text-[#B44C2E]" />
          Continue with Google
        </button>

        <div className="relative flex items-center justify-center">
          <span className="h-px flex-1 bg-[#E8DFD5]" />
          <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#7A6F64]">
            or with email
          </span>
          <span className="h-px flex-1 bg-[#E8DFD5]" />
        </div>

        {error && (
          <div className="liquid-glass-subtle border-[#B44C2E]/45 rounded-2xl p-3 text-xs font-semibold text-[#1F1C18]">
            {error}
          </div>
        )}

        <form onSubmit={onEmailAuthSubmit} className="space-y-3.5">
          {authMode === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => onChangeFullName(e.target.value)}
                  placeholder="e.g. Aarav Verma"
                  className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                  Mobile Number (10 digits)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => onChangePhone(e.target.value)}
                  placeholder="9876543210"
                  className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => onChangeEmail(e.target.value)}
              placeholder="you@example.com"
              className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
              Password {authMode === 'signup' ? '(min 6 chars)' : ''}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => onChangePassword(e.target.value)}
                placeholder="Enter password"
                className="liquid-input w-full pl-4 pr-10 py-2.5 rounded-2xl text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5349] cursor-pointer"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full liquid-btn-primary py-3 rounded-full text-xs font-bold cursor-pointer"
          >
            {submitting
              ? 'Please wait...'
              : authMode === 'signin'
              ? 'Sign In to My Account'
              : 'Create My Account'}
          </button>
        </form>

        <div className="pt-3 border-t border-[#E8DFD5] flex items-center justify-between text-xs">
          <span className="text-[#5C5349]">Are you Gayatri Stationers shop owner?</span>
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="font-bold text-[#8C341B] hover:underline cursor-pointer"
          >
            Owner Admin Login →
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   2. OWNER / STAFF ADMIN LOGIN VIEW
   ============================================================================ */
interface AdminLoginViewProps {
  email: string;
  onChangeEmail: (v: string) => void;
  password: string;
  onChangePassword: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleAdminSignIn: () => void;
  onBackHome: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  email,
  onChangeEmail,
  password,
  onChangePassword,
  submitting,
  error,
  onSubmit,
  onGoogleAdminSignIn,
  onBackHome,
}) => {
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <button
        type="button"
        onClick={onBackHome}
        className="liquid-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold mb-5 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Store
      </button>

      <div className="liquid-glass rounded-[32px] p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl liquid-btn-primary flex items-center justify-center mx-auto">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1F1C18] font-serif-display">
            Shop Manager Login
          </h1>
          <p className="text-xs text-[#5C5349]">
            Gayatri Stationers · Manage stock, pickup codes & orders
          </p>
        </div>

        <button
          type="button"
          onClick={onGoogleAdminSignIn}
          disabled={submitting}
          className="w-full liquid-btn-glass py-3 rounded-full text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 text-[#B44C2E]" />
          Sign in with Owner Google ({OWNER_EMAIL.split('@')[0]}...)
        </button>

        {error && (
          <div className="liquid-glass-subtle rounded-2xl p-3 text-xs font-semibold text-[#1F1C18]">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#1F1C18] mb-1">Owner Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => onChangeEmail(e.target.value)}
              placeholder={OWNER_EMAIL}
              className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1C18] mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => onChangePassword(e.target.value)}
                placeholder="Shop passcode"
                className="liquid-input w-full pl-4 pr-10 py-2.5 rounded-2xl text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5349] cursor-pointer"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full liquid-btn-primary py-3 rounded-full text-xs font-bold cursor-pointer"
          >
            {submitting ? 'Opening Shop Manager...' : 'Open Shop Manager'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
   3. CUSTOMER PROFILE VIEW (PROFILE, ORDERS WITH 1-TAP REORDER, WISHLIST)
   ============================================================================ */
interface ProfileViewProps {
  currentUser: any;
  fullName: string;
  onChangeFullName: (v: string) => void;
  phone: string;
  onChangePhone: (v: string) => void;
  email: string;
  shippingAddress: string;
  onChangeShippingAddress: (v: string) => void;
  shippingCity: string;
  onChangeShippingCity: (v: string) => void;
  shippingPincode: string;
  onChangeShippingPincode: (v: string) => void;
  onSaveProfile: (e: React.FormEvent) => Promise<void>;
  savingProfile: boolean;
  orders: any[];
  wishlistProducts: any[];
  onRefreshOrders: () => void;
  onReorderItems: (items: any[]) => void;
  onOpenProduct: (slug: string) => void;
  onAddProductToBag: (prod: any) => void;
  onSignOut: () => void;
  onOpenAdminDashboard?: () => void;
  onOpenSignIn: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  fullName,
  onChangeFullName,
  phone,
  onChangePhone,
  email,
  shippingAddress,
  onChangeShippingAddress,
  shippingCity,
  onChangeShippingCity,
  shippingPincode,
  onChangeShippingPincode,
  onSaveProfile,
  savingProfile,
  orders,
  wishlistProducts,
  onRefreshOrders,
  onReorderItems,
  onOpenProduct,
  onAddProductToBag,
  onSignOut,
  onOpenAdminDashboard,
  onOpenSignIn,
}) => {
  const [tab, setTab] = useState<'orders' | 'profile' | 'wishlist'>('orders');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    await onSaveProfile(e);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Profile Header Glass Card */}
      <div className="liquid-glass rounded-[32px] p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl liquid-btn-primary flex items-center justify-center text-lg font-bold shrink-0">
            {(fullName || email || 'G').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1F1C18] font-serif-display">
              {fullName || 'Gayatri Member'}
            </h1>
            <p className="text-xs text-[#5C5349]">
              {email || 'Guest shopper on this device'}
              {phone ? ` · ${phone}` : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FDF2ED] text-[#1F1C18] text-[11px] font-semibold">
                {orders.length} Order{orders.length === 1 ? '' : 's'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/80 border border-[#E8DFD5] text-[#8C341B] text-[11px] font-semibold">
                {wishlistProducts.length} Saved
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenAdminDashboard && (
            <button
              type="button"
              onClick={onOpenAdminDashboard}
              className="liquid-btn-primary px-4 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5" /> Open Shop Manager
            </button>
          )}
          {currentUser ? (
            <button
              type="button"
              onClick={onSignOut}
              className="liquid-btn-glass px-4 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSignIn}
              className="liquid-btn-primary px-4 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <User className="w-3.5 h-3.5" /> Sign In / Sync Account
            </button>
          )}
        </div>
      </div>

      {/* Section Tabs */}
      <div className="inline-flex p-1.5 rounded-full liquid-glass gap-1">
        <button
          type="button"
          onClick={() => setTab('orders')}
          className={`px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
            tab === 'orders' ? 'liquid-btn-primary text-white' : 'text-[#1F1C18]'
          }`}
        >
          <Package className="w-3.5 h-3.5" /> Orders ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('profile')}
          className={`px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
            tab === 'profile' ? 'liquid-btn-primary text-white' : 'text-[#1F1C18]'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" /> Address & Profile
        </button>
        <button
          type="button"
          onClick={() => setTab('wishlist')}
          className={`px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
            tab === 'wishlist' ? 'liquid-btn-primary text-white' : 'text-[#1F1C18]'
          }`}
        >
          <Heart className="w-3.5 h-3.5" /> Wishlist ({wishlistProducts.length})
        </button>
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1F1C18]">Order History & Pickups</h2>
            <button
              type="button"
              onClick={onRefreshOrders}
              className="liquid-btn-glass px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="liquid-glass rounded-3xl p-8 text-center">
              <ShoppingBag className="w-9 h-9 text-[#B44C2E]/40 mx-auto mb-2" />
              <p className="text-sm font-bold text-[#1F1C18]">No orders placed yet</p>
              <p className="text-xs text-[#5C5349] mt-1">
                Every order you place is saved here with live pickup codes and 1-tap reorder.
              </p>
            </div>
          ) : (
            orders.map((entry) => {
              const ord = entry.order || {};
              return (
                <div key={ord.id || ord.orderNumber} className="liquid-glass rounded-3xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular text-xs font-bold text-[#1F1C18]">
                          {ord.orderNumber}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1F1C18] text-white">
                          {ord.paymentStatus || 'PENDING'}
                        </span>
                        {entry?.pickupDetails?.pickupCode && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF2ED] text-[#1F1C18] font-mono-tabular">
                            Pickup Code: {entry.pickupDetails.pickupCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5C5349] mt-1">
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleString('en-IN') : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-[#1F1C18] tabular-nums">
                        {formatPaiseToINR(ord.totalPaise)}
                      </span>
                      {Array.isArray(entry.items) && entry.items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onReorderItems(entry.items)}
                          className="liquid-btn-primary px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
                        >
                          Reorder Bag
                        </button>
                      )}
                    </div>
                  </div>

                  <OrderTrackingTimeline orderEntry={entry} isOwnerOrStaff={false} />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Profile & Saved Delivery Address Tab */}
      {tab === 'profile' && (
        <form onSubmit={handleSave} className="liquid-glass rounded-3xl p-5 sm:p-7 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
              Personal Info & Saved Kanpur Address
            </h2>
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B44C2E]">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F1C18] mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => onChangeFullName(e.target.value)}
                placeholder="Your full name"
                className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => onChangePhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
              Street / House No. / Landmark
            </label>
            <input
              type="text"
              value={shippingAddress}
              onChange={(e) => onChangeShippingAddress(e.target.value)}
              placeholder="House no., Awas Vikas / Kidwai Nagar / Kakadeo..."
              className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
            />
          </div>

          {/* Kanpur Neighborhood Presets */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-semibold text-[#5C5349]">Quick Kanpur PIN fill:</span>
            {[
              { label: 'Naubasta (208021)', pin: '208021' },
              { label: 'Kidwai Nagar (208011)', pin: '208011' },
              { label: 'Kakadeo (208025)', pin: '208025' },
              { label: 'Civil Lines (208001)', pin: '208001' },
            ].map((area) => (
              <button
                key={area.pin}
                type="button"
                onClick={() => {
                  onChangeShippingCity('Kanpur');
                  onChangeShippingPincode(area.pin);
                }}
                className="liquid-btn-glass px-3 py-1 rounded-full font-semibold cursor-pointer"
              >
                {area.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F1C18] mb-1">City</label>
              <input
                type="text"
                value={shippingCity}
                onChange={(e) => onChangeShippingCity(e.target.value)}
                className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1C18] mb-1">PIN Code</label>
              <input
                type="text"
                maxLength={6}
                value={shippingPincode}
                onChange={(e) => onChangeShippingPincode(e.target.value.replace(/\D/g, ''))}
                className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm font-mono-tabular"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="liquid-btn-primary px-6 py-3 rounded-full text-xs font-bold cursor-pointer"
          >
            {savingProfile ? 'Saving...' : 'Save Address & Profile'}
          </button>
        </form>
      )}

      {/* Wishlist Tab */}
      {tab === 'wishlist' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wishlistProducts.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 liquid-glass rounded-3xl p-8 text-center">
              <Heart className="w-9 h-9 text-[#B44C2E]/40 mx-auto mb-2" />
              <p className="text-sm font-bold text-[#1F1C18]">No saved stationery yet</p>
            </div>
          ) : (
            wishlistProducts.map((prod) => (
              <div key={prod.id} className="liquid-glass rounded-3xl p-4 flex gap-3 items-center">
                <button
                  type="button"
                  onClick={() => onOpenProduct(prod.slug)}
                  className="w-16 h-16 rounded-2xl bg-white/85 overflow-hidden shrink-0 cursor-pointer"
                >
                  <ProductIllustration
                    type={prod.illustrationType}
                    imageUrl={prod.imageUrl}
                    alt={prod.name}
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-bold text-[#1F1C18] truncate">{prod.name}</p>
                  <p className="text-xs font-bold text-[#B44C2E]">
                    {formatPaiseToINR(prod.sellingPricePaise, false)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onAddProductToBag(prod)}
                    className="liquid-btn-primary px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer"
                  >
                    + Add to Bag
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   4. TRACK ORDERS VIEW
   ============================================================================ */
interface TrackOrdersViewProps {
  query: string;
  onChangeQuery: (v: string) => void;
  searching: boolean;
  results: any[];
  recentOrders: any[];
  onSearchSubmit: (e: React.FormEvent) => void;
  onSelectOrderNumber: (orderNumber: string) => void;
  onBackHome: () => void;
}

export const TrackOrdersView: React.FC<TrackOrdersViewProps> = ({
  query,
  onChangeQuery,
  searching,
  results,
  recentOrders,
  onSearchSubmit,
  onSelectOrderNumber,
  onBackHome,
}) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <button
        type="button"
        onClick={onBackHome}
        className="liquid-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
      </button>

      <div className="liquid-glass rounded-[32px] p-6 sm:p-8 space-y-4">
        <h1 className="text-2xl font-bold text-[#1F1C18] font-serif-display">
          Track Pickup & Delivery Orders
        </h1>
        <p className="text-xs text-[#5C5349]">
          Enter your order number (e.g. GS-2026-...) or 10-digit mobile number to view live pickup
          code and dispatch status.
        </p>

        <form onSubmit={onSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B8075] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => onChangeQuery(e.target.value)}
              placeholder="Order number (GS-...) or mobile number"
              className="liquid-input w-full pl-11 pr-4 py-3 rounded-full text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="liquid-btn-primary px-6 py-3 rounded-full text-xs font-bold cursor-pointer"
          >
            {searching ? 'Checking...' : 'Track Order'}
          </button>
        </form>

        {recentOrders.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold text-[#5C5349]">Recent on device:</span>
            {recentOrders.slice(0, 4).map((ro) => (
              <button
                key={ro.order.orderNumber}
                type="button"
                onClick={() => onSelectOrderNumber(ro.order.orderNumber)}
                className="liquid-btn-glass px-3 py-1 rounded-full text-[11px] font-mono-tabular font-bold cursor-pointer"
              >
                {ro.order.orderNumber}
              </button>
            ))}
          </div>
        )}
      </div>

      {results.map((entry) => (
        <div key={entry.order.id || entry.order.orderNumber} className="liquid-glass rounded-[32px] p-5 sm:p-6">
          <OrderTrackingTimeline orderEntry={entry} isOwnerOrStaff={false} />
        </div>
      ))}
    </div>
  );
};

/* ============================================================================
   5. INSTITUTIONAL / SCHOOL BULK ENQUIRY VIEW
   ============================================================================ */
interface BulkEnquiryViewProps {
  onBackHome: () => void;
  initialEnquiryText?: string;
}

export const BulkEnquiryView: React.FC<BulkEnquiryViewProps> = ({
  onBackHome,
  initialEnquiryText = '',
}) => {
  const [institutionName, setInstitutionName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [pincode, setPincode] = useState('208021');
  const [notes, setNotes] = useState(initialEnquiryText);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/bulk-enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionName,
          contactPerson,
          phone: digits.slice(-10),
          email,
          gstin,
          deliveryPincode: pincode,
          notes,
          itemsRequested: [{ description: notes || 'School / Office Annual Supply List' }],
        }),
      });
      const data = await res.json();
      setSubmittedRef(data?.enquiry?.enquiryNumber || `GS-BULK-${Date.now().toString().slice(-4)}`);
      setInstitutionName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setGstin('');
      setNotes('');
    } catch {
      setError('Could not submit request. Please call Kanpur desk directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <button
        type="button"
        onClick={onBackHome}
        className="liquid-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 liquid-glass-dark text-white rounded-[32px] p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full">
              <Building2 className="w-3.5 h-3.5" /> Wholesale & GST Billing
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif-display">
              Schools, Coaching Institutes & Office Bulk Supply
            </h1>
            <p className="text-xs text-[#FFF5F0]/85 leading-relaxed">
              Special wholesale carton slabs for Classmate registers, JK Copier A4 reams, Flair/Cello
              pens, Doms exam kits & art supplies across Kanpur Nagar.
            </p>
          </div>

          <div className="space-y-2.5 text-xs text-[#FFF5F0]">
            <p className="font-semibold text-white">Kanpur Wholesale Counter</p>
            <p>{STORE_ADDRESS}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href={`tel:${STORE_PHONE.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-1.5 underline"
              >
                <Phone className="w-3.5 h-3.5" /> {STORE_PHONE}
              </a>
              <a href={`mailto:${STORE_EMAIL}`} className="inline-flex items-center gap-1.5 underline">
                <Mail className="w-3.5 h-3.5" /> {STORE_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 liquid-glass rounded-[32px] p-6 sm:p-8">
          {submittedRef ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-[#B44C2E] mx-auto" />
              <h2 className="text-xl font-bold text-[#1F1C18] font-serif-display">
                Quote Request Received!
              </h2>
              <p className="text-xs text-[#5C5349]">
                Reference ID: <span className="font-mono-tabular font-bold">{submittedRef}</span>. Our
                Kanpur store team will call with wholesale slab pricing within 4 business hours.
              </p>
              <button
                type="button"
                onClick={() => setSubmittedRef(null)}
                className="liquid-btn-primary px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
              >
                Submit Another List
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
                Request Wholesale Quote
              </h2>
              {error && (
                <div className="liquid-glass-subtle rounded-2xl p-3 text-xs font-semibold text-[#1F1C18]">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <input
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="School / College / Company Name *"
                  className="liquid-input px-4 py-2.5 rounded-2xl text-xs sm:text-sm"
                />
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Contact Person Name *"
                  className="liquid-input px-4 py-2.5 rounded-2xl text-xs sm:text-sm"
                />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile / WhatsApp Number *"
                  className="liquid-input px-4 py-2.5 rounded-2xl text-xs sm:text-sm"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="liquid-input px-4 py-2.5 rounded-2xl text-xs sm:text-sm"
                />
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="GSTIN for B2B Tax Invoice (optional)"
                  className="liquid-input px-4 py-2.5 rounded-2xl text-xs sm:text-sm uppercase"
                />
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Delivery PIN (e.g. 208021)"
                  className="liquid-input px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-mono-tabular"
                />
              </div>
              <textarea
                rows={4}
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="List items & approximate quantities (e.g., 200 Classmate 172p single line notebooks, 20 cartons JK Copier A4, 150 pen packs)..."
                className="liquid-input w-full px-4 py-3 rounded-2xl text-xs sm:text-sm"
              />
              <button
                type="submit"
                disabled={submitting}
                className="liquid-btn-primary px-6 py-3 rounded-full text-xs font-bold cursor-pointer"
              >
                {submitting ? 'Sending Quote Request...' : 'Send Bulk Quote Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
