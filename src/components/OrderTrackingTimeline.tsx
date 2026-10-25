import React, { useState } from 'react';
import {
  formatPaiseToINR,
  getAllowedNextOrderStatuses,
  OrderStatus,
  FulfilmentMethod,
} from '../lib/domain-logic.ts';
import {
  CheckCircle2,
  Clock,
  Store,
  Truck,
  Package,
  AlertTriangle,
  ShieldCheck,
  MapPin,
  CreditCard,
  ExternalLink,
} from 'lucide-react';

interface OrderTrackingTimelineProps {
  orderEntry: any;
  isOwnerOrStaff?: boolean;
  idToken?: string | null;
  onOrderUpdated?: (updatedOrderEntry?: any) => void;
  onSwitchToOwnerRole?: () => void;
}

const HOME_DELIVERY_STAGES: Array<{
  status: OrderStatus;
  label: string;
  sublabel: string;
}> = [
  { status: 'ORDER_PLACED', label: 'Order Placed', sublabel: 'Stock reserved online' },
  { status: 'CONFIRMED', label: 'Confirmed', sublabel: 'Verified for courier dispatch' },
  { status: 'PROCESSING', label: 'Processing', sublabel: 'Items picked from shelf' },
  { status: 'PACKED', label: 'Packed', sublabel: 'Shipping label generated' },
  { status: 'DISPATCHED', label: 'Dispatched', sublabel: 'Handed to express courier' },
  { status: 'DELIVERED', label: 'Delivered', sublabel: 'Completed at doorstep' },
];

export const OrderTrackingTimeline: React.FC<OrderTrackingTimelineProps> = ({
  orderEntry,
  isOwnerOrStaff = false,
  idToken,
  onOrderUpdated,
}) => {
  const [workflowNote, setWorkflowNote] = useState('');
  const [courierName, setCourierName] = useState(
    orderEntry?.shipmentDetails?.courierName || 'Express Home Delivery'
  );
  const [trackingNumber, setTrackingNumber] = useState(
    orderEntry?.shipmentDetails?.trackingNumber || ''
  );
  const [collectedByName, setCollectedByName] = useState(
    orderEntry?.pickupDetails?.collectedByName || ''
  );
  const [offlinePaymentRef, setOfflinePaymentRef] = useState('');
  const [updating, setUpdating] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!orderEntry || !orderEntry.order) return null;

  const order = orderEntry.order;
  const isPickup = order.fulfilmentMethod === 'STORE_PICKUP';
  const isCancelled = order.orderStatus === 'CANCELLED';
  const isCollected = order.orderStatus === 'COLLECTED';

  // Find current stage index for Home Delivery (Shiprocket)
  const currentStageIndex = HOME_DELIVERY_STAGES.findIndex(
    (s) => s.status === order.orderStatus
  );

  const allowedNextStatuses = getAllowedNextOrderStatuses(
    order.fulfilmentMethod as FulfilmentMethod,
    order.orderStatus as OrderStatus
  );

  const handleOwnerWorkflowUpdate = async (
    nextOrderStatus?: OrderStatus,
    nextPaymentStatus?: 'PENDING' | 'PAID' | 'REFUNDED',
    customCourier?: string,
    customAwb?: string
  ) => {
    setUpdating(true);
    setActionError(null);
    setActionFeedback(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
      const effectiveCourier = customCourier || courierName || 'Shiprocket Express';
      const effectiveAwb = customAwb || trackingNumber || undefined;
      const res = await fetch(`/api/admin/orders/${order.id}/update-workflow`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nextOrderStatus,
          nextPaymentStatus,
          note: workflowNote || undefined,
          courierName: !isPickup ? effectiveCourier : undefined,
          trackingNumber: !isPickup ? effectiveAwb : undefined,
          trackingUrl:
            !isPickup && effectiveAwb
              ? `https://shiprocket.co/tracking/${effectiveAwb}`
              : undefined,
          collectedByName: collectedByName || undefined,
          offlinePaymentReference: offlinePaymentRef || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update order status');
      }
      setWorkflowNote('');
      setActionFeedback(
        `Order ${order.orderNumber} updated to ${(nextOrderStatus || order.orderStatus).replace(
          /_/g,
          ' '
        )}.`
      );
      if (onOrderUpdated) {
        onOrderUpdated(data.order);
      }
    } catch (err: any) {
      setActionError(err.message || 'Could not update order.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-white border border-stone-200/80 rounded-[32px] overflow-hidden shadow-xs">
      {/* Top Order Summary Header */}
      <div className="p-5 sm:p-7 bg-slate-50 border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[11px] ${
                isPickup
                  ? 'bg-amber-100 text-amber-950 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
              }`}
            >
              {isPickup
                ? 'Get at Store (No Tracking — Direct Counter Collection)'
                : 'Express Home Delivery (Live Tracking)'}
            </span>
            <span>·</span>
            <span>Placed {new Date(order.createdAt).toLocaleString('en-IN')}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-mono-tabular text-stone-900">
            {order.orderNumber}
          </h2>
          <p className="text-xs sm:text-sm text-stone-700">
            Customer: <strong>{order.customerName}</strong> · Phone:{' '}
            <span className="font-mono-tabular">{order.customerPhone}</span>
            {order.customerEmail ? ` · ${order.customerEmail}` : ''}
          </p>
        </div>

        <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-200">
          <div className="text-left sm:text-right">
            <span className="text-[11px] uppercase tracking-wider text-stone-500 block">
              {isPickup ? 'Collection Status' : 'Delivery Stage'}
            </span>
            <span
              className={`font-mono-tabular text-sm sm:text-base font-bold ${
                isCancelled
                  ? 'text-red-700'
                  : isCollected || order.orderStatus === 'DELIVERED'
                  ? 'text-emerald-800'
                  : 'text-[#B42318]'
              }`}
            >
              {isPickup
                ? isCancelled
                  ? 'CANCELLED'
                  : isCollected
                  ? 'COLLECTED AT STORE ✓'
                  : 'READY — VISIT STORE & COLLECT'
                : order.orderStatus.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="text-right font-mono-tabular text-xs">
            <span
              className={`font-semibold ${
                order.paymentStatus === 'PAID'
                  ? 'text-emerald-800'
                  : order.paymentStatus === 'REFUNDED'
                  ? 'text-stone-600'
                  : 'text-amber-800'
              }`}
            >
              Payment: {order.paymentStatus}
            </span>{' '}
            <span className="text-stone-500">
              ({order.paymentMethod.replace(/_/g, ' ')})
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-5 sm:p-7 space-y-6">
        {/* Cancelled Alert Banner */}
        {isCancelled ? (
          <div className="p-5 bg-red-50 border border-red-200 rounded-3xl flex items-start gap-3 text-xs sm:text-sm text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">This order has been cancelled</p>
              <p className="mt-0.5 text-red-800">
                Reserved stock quantities have been automatically restored to the Gayatri Stationers inventory ledger.
              </p>
            </div>
          </div>
        ) : isPickup ? (
          /* GET AT STORE: NO ORDER TRACKING — DIRECT WALK-IN COUNTER PASS */
          <div
            className={`p-5 sm:p-6 rounded-3xl border space-y-3 ${
              isCollected
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : 'bg-amber-50/90 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    isCollected ? 'bg-emerald-700 text-white' : 'bg-[#B42318] text-white'
                  }`}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-80">
                    GET AT STORE · NO ORDER TRACKING REQUIRED
                  </span>
                  <h3 className="text-sm sm:text-base font-bold mt-0.5">
                    {isCollected
                      ? 'Order Collected from Gayatri Stationers Counter'
                      : 'Just Order & Get It — Ready for Direct Counter Collection'}
                  </h3>
                </div>
              </div>
              {orderEntry.pickupDetails?.pickupCode && (
                <div className="px-4 py-2 bg-white border-2 border-stone-900 rounded-2xl text-center shrink-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 block">
                    STORE PICKUP CODE
                  </span>
                  <span className="font-mono-tabular font-bold text-base sm:text-lg text-stone-900">
                    {orderEntry.pickupDetails.pickupCode}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm leading-relaxed">
              {isCollected
                ? `This order was handed over at our Kanpur store counter${
                    orderEntry.pickupDetails?.collectedAt
                      ? ` on ${new Date(orderEntry.pickupDetails.collectedAt).toLocaleString('en-IN')}`
                      : ''
                  }.`
                : 'Store Pickup orders do not require shipment or order tracking. Simply visit our retail counter during store hours, show your Order Number or Pickup Code above, and collect your stationery bag immediately.'}
            </p>

            <div className="p-3.5 bg-white/90 border border-stone-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#B42318] shrink-0" />
                <span>
                  <strong>Store Counter:</strong> Awas Vikas Market, Galla Mandi, Naubasta, Kanpur, UP – 208021
                </span>
              </div>
              <span className="font-mono-tabular text-[11px] text-stone-600">
                Mon–Sat: 10:00 AM – 8:00 PM
              </span>
            </div>
          </div>
        ) : (
          /* HOME DELIVERY: VISUAL MULTI-STAGE SHIPROCKET PROGRESS STEPPER */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-600 mb-3">
              <span className="font-semibold text-stone-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-700" />
                <span>Express Doorstep Delivery Tracking</span>
              </span>
              <span className="font-mono-tabular">
                Step {Math.max(1, currentStageIndex + 1)} of {HOME_DELIVERY_STAGES.length}
              </span>
            </div>

            {/* Desktop Horizontal Stepper (md and up) */}
            <div className="hidden md:grid md:grid-cols-6 gap-2.5">
              {HOME_DELIVERY_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                const isDoneFinal = isCurrent && stage.status === 'DELIVERED';
                return (
                  <div
                    key={stage.status}
                    className={`p-3.5 rounded-[24px] border transition-colors ${
                      isCompleted || isDoneFinal
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                        : isCurrent
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 border-stone-200 text-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <span className="font-mono-tabular text-[11px] font-bold">
                        0{idx + 1}
                      </span>
                      {isCompleted || isDoneFinal ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4 text-amber-300 shrink-0" />
                      ) : null}
                    </div>
                    <p className="text-xs font-bold leading-snug">{stage.label}</p>
                    <p
                      className={`text-[11px] mt-0.5 leading-tight ${
                        isCurrent && !isDoneFinal
                          ? 'text-stone-300'
                          : isCompleted || isDoneFinal
                          ? 'text-emerald-800'
                          : 'text-stone-400'
                      }`}
                    >
                      {stage.sublabel}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Mobile Vertical Stepper (< md) */}
            <div className="md:hidden space-y-2">
              {HOME_DELIVERY_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                const isDoneFinal = isCurrent && stage.status === 'DELIVERED';
                return (
                  <div
                    key={stage.status}
                    className={`p-3.5 rounded-3xl border flex items-center justify-between gap-3 ${
                      isCompleted || isDoneFinal
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                        : isCurrent
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 border-stone-200 text-stone-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono-tabular text-xs font-bold w-6 text-center">
                        0{idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold">{stage.label}</p>
                        <p
                          className={`text-[11px] ${
                            isCurrent && !isDoneFinal
                              ? 'text-stone-300'
                              : isCompleted || isDoneFinal
                              ? 'text-emerald-800'
                              : 'text-stone-400'
                          }`}
                        >
                          {stage.sublabel}
                        </p>
                      </div>
                    </div>
                    {isCompleted || isDoneFinal ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : isCurrent ? (
                      <span className="text-[10px] font-mono-tabular uppercase px-2.5 py-0.5 bg-amber-500/20 text-amber-200 rounded-full">
                        Active
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Home Delivery Shiprocket Shipment Details & Payment Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {!isPickup && orderEntry.shipmentDetails && (
            <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-3xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Courier &amp; AWB Shipment Tracking</span>
                </div>
                <span className="font-mono-tabular font-semibold px-2.5 py-0.5 bg-white border border-emerald-300 rounded-full text-emerald-900">
                  PIN: {orderEntry.shipmentDetails.pincode}
                </span>
              </div>
              <p className="text-stone-700 leading-relaxed">
                <strong>Recipient:</strong> {orderEntry.shipmentDetails.recipientName} (
                {orderEntry.shipmentDetails.phone})<br />
                {orderEntry.shipmentDetails.addressLine1}
                {orderEntry.shipmentDetails.addressLine2
                  ? `, ${orderEntry.shipmentDetails.addressLine2}`
                  : ''}
                , {orderEntry.shipmentDetails.city}, {orderEntry.shipmentDetails.state} -{' '}
                {orderEntry.shipmentDetails.pincode}
              </p>
              {orderEntry.shipmentDetails.trackingNumber ? (
                <div className="p-3.5 bg-white border border-emerald-200 rounded-2xl space-y-1.5 font-mono-tabular text-stone-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-xs">
                      Courier: {(orderEntry.shipmentDetails.courierName || 'Express Courier').replace(/Shiprocket/gi, 'Express')}
                    </p>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[11px] font-bold">
                      AWB: {orderEntry.shipmentDetails.trackingNumber}
                    </span>
                  </div>
                  {orderEntry.shipmentDetails.dispatchedAt && (
                    <p className="text-[11px] text-stone-500">
                      Dispatched via Shiprocket:{' '}
                      {new Date(orderEntry.shipmentDetails.dispatchedAt).toLocaleString('en-IN')}
                    </p>
                  )}
                  <a
                    href={
                      orderEntry.shipmentDetails.trackingUrl ||
                      `https://shiprocket.co/tracking/${orderEntry.shipmentDetails.trackingNumber}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-sans font-bold text-emerald-800 hover:underline pt-1"
                  >
                    <span>Open Live Shiprocket AWB Tracker</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-white/80 border border-stone-200 rounded-2xl text-stone-600">
                  Parcel assigned to <strong>Shiprocket</strong>. Your live AWB tracking number and courier partner link will appear here as soon as the parcel is dispatched.
                </div>
              )}
            </div>
          )}

          {/* Payment & Invoice Breakdown Summary */}
          <div
            className={`p-5 bg-stone-50 border border-stone-200 rounded-3xl space-y-2 text-xs ${
              isPickup ? 'lg:col-span-2' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                <CreditCard className="w-4 h-4 text-stone-800 shrink-0" />
                <span>Payment &amp; GST Summary</span>
              </div>
              <span className="font-mono-tabular font-bold text-sm text-stone-900">
                {formatPaiseToINR(order.totalPaise)}
              </span>
            </div>
            <div className="space-y-1 font-mono-tabular text-stone-600 pt-1">
              <div className="flex justify-between">
                <span>Items Subtotal (Incl. GST)</span>
                <span>{formatPaiseToINR(order.subtotalPaise)}</span>
              </div>
              {order.discountPaise > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon Discount ({order.couponCode})</span>
                  <span>-{formatPaiseToINR(order.discountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>
                  {isPickup ? 'Get at Store Counter Fee' : 'Shiprocket Home Delivery Fee'}
                </span>
                <span>
                  {order.shippingPaise === 0 ? 'FREE' : formatPaiseToINR(order.shippingPaise)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-stone-500">
                <span>Included GST Tax Component</span>
                <span>{formatPaiseToINR(order.taxPaise, true)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* STORE OWNER / STAFF CONTROL PANEL */}
        {isOwnerOrStaff && (
          <div className="p-5 sm:p-6 bg-slate-900 text-white rounded-[32px] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold tracking-wide uppercase">
                  {isPickup
                    ? 'Store Counter Handover Controls (Get at Store — No Tracking)'
                    : 'Shiprocket Courier Dispatch & Order Tracking Controls'}
                </h3>
              </div>
            </div>

            {actionFeedback && (
              <div className="p-3 bg-emerald-950 border border-emerald-700 rounded-full text-xs text-emerald-200">
                {actionFeedback}
              </div>
            )}

            {actionError && (
              <div className="p-3 bg-red-950 border border-red-700 rounded-full text-xs text-red-200">
                {actionError}
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Shiprocket Courier & AWB Inputs for Home Delivery */}
              {!isPickup && (
                <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-3xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
                      Shiprocket Fulfilment &amp; AWB Assignment
                    </span>
                    {order.orderStatus !== 'DISPATCHED' &&
                      order.orderStatus !== 'DELIVERED' &&
                      order.orderStatus !== 'CANCELLED' && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => {
                            const autoAwb =
                              trackingNumber.trim() ||
                              `SR${order.orderNumber.replace(/[^A-Z0-9]/g, '')}`;
                            const autoCourier = courierName.trim() || 'Shiprocket Express';
                            setCourierName(autoCourier);
                            setTrackingNumber(autoAwb);
                            handleOwnerWorkflowUpdate(
                              'DISPATCHED',
                              undefined,
                              autoCourier,
                              autoAwb
                            );
                          }}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full cursor-pointer disabled:opacity-50"
                        >
                          ⚡ 1-Click Dispatch via Shiprocket (Auto-AWB)
                        </button>
                      )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1">
                        Shiprocket Courier Partner
                      </label>
                      <select
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        className="w-full px-4 py-2 rounded-full bg-slate-900 border border-slate-700 text-white"
                      >
                        <option value="Shiprocket Express">Shiprocket Express</option>
                        <option value="Delhivery (via Shiprocket)">Delhivery (via Shiprocket)</option>
                        <option value="BlueDart (via Shiprocket)">BlueDart (via Shiprocket)</option>
                        <option value="Xpressbees (via Shiprocket)">Xpressbees (via Shiprocket)</option>
                        <option value="DTDC (via Shiprocket)">DTDC (via Shiprocket)</option>
                        <option value="Ecom Express (via Shiprocket)">Ecom Express (via Shiprocket)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">
                        Shiprocket AWB / Tracking Number
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder={`e.g. SR${order.orderNumber.replace(/[^A-Z0-9]/g, '')}`}
                        className="w-full px-4 py-2 rounded-full bg-slate-900 border border-slate-700 text-white font-mono-tabular placeholder-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Store Pickup Direct Handover */}
              {isPickup && !isCollected && !isCancelled && (
                <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-amber-300">
                      Direct Store Handover (No Tracking Required)
                    </p>
                    <input
                      type="text"
                      value={collectedByName}
                      onChange={(e) => setCollectedByName(e.target.value)}
                      placeholder={`Collected by (default: ${order.customerName})`}
                      className="w-full px-4 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-white placeholder-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleOwnerWorkflowUpdate('COLLECTED', 'PAID')}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-full whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    ✓ Hand Over &amp; Mark Collected at Store
                  </button>
                </div>
              )}

              {/* Record Counter / COD Payment */}
              {order.paymentStatus === 'PENDING' && order.orderStatus !== 'CANCELLED' && (
                <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold text-amber-300">
                      Pending Payment Collection: {formatPaiseToINR(order.totalPaise)} (
                      {order.paymentMethod.replace(/_/g, ' ')})
                    </p>
                    <input
                      type="text"
                      value={offlinePaymentRef}
                      onChange={(e) => setOfflinePaymentRef(e.target.value)}
                      placeholder="Cash / UPI Receipt Reference (optional)"
                      className="w-full px-4 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleOwnerWorkflowUpdate(undefined, 'PAID')}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-full whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Record Payment (Mark PAID)
                  </button>
                </div>
              )}

              {/* Staff Note & Stage Transition Buttons */}
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={workflowNote}
                  onChange={(e) => setWorkflowNote(e.target.value)}
                  placeholder="Add owner / staff note..."
                  className="w-full px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400"
                />

                <div className="flex flex-wrap items-center gap-2">
                  {isPickup ? (
                    <>
                      {!isCollected && !isCancelled && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => handleOwnerWorkflowUpdate('COLLECTED', 'PAID')}
                          className="px-4 py-2 rounded-full font-semibold bg-white text-slate-900 hover:bg-amber-300 cursor-pointer disabled:opacity-50"
                        >
                          Mark Collected at Store
                        </button>
                      )}
                      {!isCollected && !isCancelled && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => handleOwnerWorkflowUpdate('CANCELLED', undefined)}
                          className="px-4 py-2 rounded-full font-semibold bg-red-900/80 text-red-100 hover:bg-red-800 border border-red-700 cursor-pointer disabled:opacity-50"
                        >
                          Cancel Order
                        </button>
                      )}
                    </>
                  ) : (
                    allowedNextStatuses.map((nextSt) => (
                      <button
                        key={nextSt}
                        type="button"
                        disabled={updating}
                        onClick={() => handleOwnerWorkflowUpdate(nextSt, undefined)}
                        className={`px-4 py-2 rounded-full font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                          nextSt === 'CANCELLED'
                            ? 'bg-red-900/80 text-red-100 hover:bg-red-800 border border-red-700'
                            : 'bg-white text-slate-900 hover:bg-amber-300'
                        }`}
                      >
                        Advance to: {nextSt.replace(/_/g, ' ')}
                      </button>
                    ))
                  )}

                  {!isPickup && (courierName || trackingNumber) && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleOwnerWorkflowUpdate(undefined, undefined)}
                      className="px-4 py-2 rounded-full font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer disabled:opacity-50"
                    >
                      Save Shiprocket AWB Info
                    </button>
                  )}

                  {order.paymentStatus === 'PAID' && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleOwnerWorkflowUpdate(undefined, 'REFUNDED')}
                      className="px-4 py-2 rounded-full font-medium bg-amber-900/70 hover:bg-amber-800 text-amber-100 border border-amber-700 cursor-pointer disabled:opacity-50"
                    >
                      Process Refund
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ordered Items & Timestamped Tracking Log (Tracking Log shown only for Home Delivery) */}
        <div className={`grid grid-cols-1 ${isPickup ? '' : 'lg:grid-cols-2'} gap-6 pt-2`}>
          {/* Ordered Items List */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-stone-600" />
              <span>Ordered Stationery Items ({orderEntry.items?.length || 0})</span>
            </h3>
            <div className="border border-stone-200 rounded-3xl overflow-hidden divide-y divide-stone-200 text-xs">
              {(orderEntry.items || []).map((it: any) => (
                <div key={it.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-stone-900">
                      {it.quantity} × {it.productName}
                    </p>
                    <p className="text-[11px] text-stone-500 font-mono-tabular">
                      {it.variantName} · SKU: {it.sku} · {formatPaiseToINR(it.unitPricePaise)} each
                    </p>
                  </div>
                  <span className="font-mono-tabular font-bold text-stone-900 shrink-0">
                    {formatPaiseToINR(it.lineTotalPaise)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Audit & Shiprocket Tracking Activity Log — Only for Home Delivery orders */}
          {!isPickup && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-stone-600" />
                <span>Shiprocket Delivery &amp; Activity Log</span>
              </h3>
              <div className="border border-stone-200 rounded-3xl overflow-hidden divide-y divide-stone-100 max-h-60 overflow-y-auto text-xs">
                {(orderEntry.activityLogs || []).map((log: any) => (
                  <div key={log.id} className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular font-semibold text-stone-900 text-[11px]">
                        {log.statusTo ? log.statusTo.replace(/_/g, ' ') : 'UPDATE'}
                      </span>
                      <span className="text-[11px] text-stone-500 font-mono-tabular">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-stone-700">{log.note}</p>
                    <p className="text-[10px] text-stone-400 font-mono-tabular">
                      By: {log.actorEmail} ({log.actorRole})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
