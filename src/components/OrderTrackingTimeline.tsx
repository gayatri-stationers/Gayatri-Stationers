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
import { STORE_ADDRESS } from '../data/defaults.ts';

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
  { status: 'CONFIRMED', label: 'Confirmed', sublabel: 'Ready for dispatch' },
  { status: 'PROCESSING', label: 'Processing', sublabel: 'Picked from shelf' },
  { status: 'PACKED', label: 'Packed', sublabel: 'Label generated' },
  { status: 'DISPATCHED', label: 'Dispatched', sublabel: 'With express courier' },
  { status: 'DELIVERED', label: 'Delivered', sublabel: 'Completed' },
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

  const currentStageIndex = Math.max(
    0,
    HOME_DELIVERY_STAGES.findIndex((s) => s.status === order.orderStatus)
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
      const effectiveCourier = customCourier || courierName || 'Express Home Delivery';
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
    <div className="liquid-glass rounded-[30px] overflow-hidden">
      {/* Top Order Summary Header */}
      <div className="p-5 sm:p-7 liquid-glass-subtle border-b border-[#E8DFD5]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C5349]">
            <span className="px-3 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] bg-[#B44C2E] text-white">
              {isPickup ? 'Get at Store · Direct Counter Pass' : 'Express Home Delivery'}
            </span>
            <span>·</span>
            <span>Placed {new Date(order.createdAt).toLocaleString('en-IN')}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-mono-tabular text-[#1F1C18]">
            {order.orderNumber}
          </h2>
          <p className="text-xs sm:text-sm text-[#1F1C18]/80">
            Customer: <strong>{order.customerName}</strong> ·{' '}
            <span className="font-mono-tabular">{order.customerPhone}</span>
            {order.customerEmail ? ` · ${order.customerEmail}` : ''}
          </p>
        </div>

        <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E8DFD5]">
          <div className="text-left sm:text-right">
            <span className="text-[11px] uppercase tracking-wider text-[#5C5349] block">
              {isPickup ? 'Collection Status' : 'Delivery Stage'}
            </span>
            <span className="font-mono-tabular text-sm sm:text-base font-bold text-[#8C341B]">
              {isPickup
                ? isCancelled
                  ? 'CANCELLED'
                  : isCollected
                  ? 'COLLECTED AT STORE ✓'
                  : 'READY — VISIT & COLLECT'
                : order.orderStatus.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="text-right font-mono-tabular text-xs">
            <span className="font-bold text-[#1F1C18]">Payment: {order.paymentStatus}</span>{' '}
            <span className="text-[#5C5349]">
              ({order.paymentMethod.replace(/_/g, ' ')})
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-5 sm:p-7 space-y-6">
        {isCancelled ? (
          <div className="p-5 liquid-glass-subtle border border-[#D9C7B8]/60 rounded-3xl flex items-start gap-3 text-xs sm:text-sm text-[#1F1C18]">
            <AlertTriangle className="w-5 h-5 text-[#B44C2E] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">This order has been cancelled</p>
              <p className="mt-0.5 text-[#4A423B]">
                Reserved items have been returned to Gayatri Stationers store stock.
              </p>
            </div>
          </div>
        ) : isPickup ? (
          <div className="p-5 sm:p-6 rounded-[26px] liquid-glass-subtle border border-[#E8DFD5]/70 space-y-3 text-[#1F1C18]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl liquid-btn-primary flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-[#B44C2E]">
                    GET AT STORE · NO TRACKING NEEDED
                  </span>
                  <h3 className="text-sm sm:text-base font-bold mt-0.5">
                    {isCollected
                      ? 'Collected from Gayatri Stationers Counter ✓'
                      : 'Show Pickup Code at Store Counter & Collect'}
                  </h3>
                </div>
              </div>
              {orderEntry.pickupDetails?.pickupCode && (
                <div className="px-4 py-2 bg-white/90 border-2 border-[#B44C2E] rounded-2xl text-center shrink-0 shadow-xs">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#5C5349] block">
                    PICKUP CODE
                  </span>
                  <span className="font-mono-tabular font-bold text-base sm:text-lg text-[#1F1C18]">
                    {orderEntry.pickupDetails.pickupCode}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm text-[#4A423B] leading-relaxed">
              {isCollected
                ? `Collected at our Kanpur retail counter${
                    orderEntry.pickupDetails?.collectedAt
                      ? ` on ${new Date(orderEntry.pickupDetails.collectedAt).toLocaleString('en-IN')}`
                      : ''
                  }.`
                : 'Simply visit our counter during store hours and show your Order Number or Pickup Code above to get your packed stationery bag immediately.'}
            </p>

            <div className="p-3.5 bg-white/80 border border-[#E8DFD5] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#1F1C18]">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#B44C2E] shrink-0" />
                <span>
                  <strong>Counter:</strong> {STORE_ADDRESS}
                </span>
              </div>
              <span className="font-mono-tabular text-[11px] text-[#5C5349]">
                Mon–Sat: 10:00 AM – 8:00 PM
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#5C5349]">
              <span className="font-semibold text-[#1F1C18] flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#B44C2E]" />
                <span>Express Doorstep Delivery Progress</span>
              </span>
              <span className="font-mono-tabular">
                Step {currentStageIndex + 1} of {HOME_DELIVERY_STAGES.length}
              </span>
            </div>

            {/* Desktop Horizontal Stepper */}
            <div className="hidden md:grid md:grid-cols-6 gap-2.5">
              {HOME_DELIVERY_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                const isDoneFinal = isCurrent && stage.status === 'DELIVERED';
                return (
                  <div
                    key={stage.status}
                    className={`p-3.5 rounded-[22px] border transition-colors ${
                      isCompleted || isDoneFinal
                        ? 'bg-[#FDF2ED] border-[#D9C7B8] text-[#1F1C18]'
                        : isCurrent
                        ? 'liquid-glass-dark text-white'
                        : 'bg-white/50 border-[#E8DFD5] text-[#8B8075]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <span className="font-mono-tabular text-[11px] font-bold">0{idx + 1}</span>
                      {isCompleted || isDoneFinal ? (
                        <CheckCircle2 className="w-4 h-4 text-[#B44C2E] shrink-0" />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4 text-[#FCEAE3] shrink-0" />
                      ) : null}
                    </div>
                    <p className="text-xs font-bold leading-snug">{stage.label}</p>
                    <p className="text-[11px] mt-0.5 leading-tight opacity-75">{stage.sublabel}</p>
                  </div>
                );
              })}
            </div>

            {/* Mobile Vertical Stepper */}
            <div className="md:hidden space-y-2">
              {HOME_DELIVERY_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                const isDoneFinal = isCurrent && stage.status === 'DELIVERED';
                return (
                  <div
                    key={stage.status}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                      isCompleted || isDoneFinal
                        ? 'bg-[#FDF2ED] border-[#D9C7B8] text-[#1F1C18]'
                        : isCurrent
                        ? 'liquid-glass-dark text-white'
                        : 'bg-white/50 border-[#E8DFD5] text-[#8B8075]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono-tabular text-xs font-bold w-6 text-center">
                        0{idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold">{stage.label}</p>
                        <p className="text-[11px] opacity-75">{stage.sublabel}</p>
                      </div>
                    </div>
                    {isCompleted || isDoneFinal ? (
                      <CheckCircle2 className="w-4 h-4 text-[#B44C2E] shrink-0" />
                    ) : isCurrent ? (
                      <span className="text-[10px] font-mono-tabular uppercase px-2.5 py-0.5 bg-white/20 text-white rounded-full">
                        Current
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {!isPickup && orderEntry.shipmentDetails && (
            <div className="p-5 liquid-glass-subtle rounded-3xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-[#1F1C18] text-sm">
                  <Truck className="w-4 h-4 text-[#B44C2E] shrink-0" />
                  <span>Delivery &amp; Tracking</span>
                </div>
                <span className="font-mono-tabular font-semibold px-2.5 py-0.5 bg-white border border-[#E8DFD5] rounded-full text-[#1F1C18]">
                  PIN: {orderEntry.shipmentDetails.pincode}
                </span>
              </div>
              <p className="text-[#4A423B] leading-relaxed">
                <strong>Recipient:</strong> {orderEntry.shipmentDetails.recipientName} (
                {orderEntry.shipmentDetails.phone})
                <br />
                {orderEntry.shipmentDetails.addressLine1}
                {orderEntry.shipmentDetails.addressLine2
                  ? `, ${orderEntry.shipmentDetails.addressLine2}`
                  : ''}
                , {orderEntry.shipmentDetails.city}, {orderEntry.shipmentDetails.state} -{' '}
                {orderEntry.shipmentDetails.pincode}
              </p>
              {orderEntry.shipmentDetails.trackingNumber ? (
                <div className="p-3.5 bg-white/85 border border-[#E8DFD5] rounded-2xl space-y-1.5 font-mono-tabular text-[#1F1C18]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-xs">
                      Courier: {orderEntry.shipmentDetails.courierName || 'Express Delivery'}
                    </p>
                    <span className="px-2 py-0.5 bg-[#FDF2ED] text-[#8C341B] rounded-full text-[11px] font-bold">
                      AWB: {orderEntry.shipmentDetails.trackingNumber}
                    </span>
                  </div>
                  <a
                    href={
                      orderEntry.shipmentDetails.trackingUrl ||
                      `https://shiprocket.co/tracking/${orderEntry.shipmentDetails.trackingNumber}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-sans font-bold text-[#B44C2E] hover:underline pt-1"
                  >
                    <span>Open Courier Tracker</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-white/70 border border-[#E8DFD5] rounded-2xl text-[#4A423B]">
                  Courier tracking link appears here automatically as soon as your parcel leaves our Kanpur counter.
                </div>
              )}
            </div>
          )}

          <div
            className={`p-5 liquid-glass-subtle rounded-3xl space-y-2 text-xs ${
              isPickup ? 'lg:col-span-2' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-[#1F1C18] text-sm">
                <CreditCard className="w-4 h-4 text-[#B44C2E] shrink-0" />
                <span>Payment &amp; GST Receipt Summary</span>
              </div>
              <span className="font-mono-tabular font-bold text-sm text-[#1F1C18]">
                {formatPaiseToINR(order.totalPaise)}
              </span>
            </div>
            <div className="space-y-1 font-mono-tabular text-[#4A423B] pt-1">
              <div className="flex justify-between">
                <span>Items Subtotal (Incl. GST)</span>
                <span>{formatPaiseToINR(order.subtotalPaise)}</span>
              </div>
              {order.discountPaise > 0 && (
                <div className="flex justify-between text-[#B44C2E] font-semibold">
                  <span>Coupon Discount ({order.couponCode || 'PROMO'})</span>
                  <span>-{formatPaiseToINR(order.discountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{isPickup ? 'Counter Pickup Fee' : 'Home Delivery Fee'}</span>
                <span>
                  {order.shippingPaise === 0 ? 'FREE' : formatPaiseToINR(order.shippingPaise)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-[#5C5349]">
                <span>Included GST Tax Component</span>
                <span>{formatPaiseToINR(order.taxPaise, true)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Simple Owner Control Panel inside Timeline */}
        {isOwnerOrStaff && (
          <div className="p-5 sm:p-6 liquid-glass-dark text-white rounded-[28px] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/15 pb-3">
              <ShieldCheck className="w-4 h-4 text-[#FCEAE3] shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold tracking-wide uppercase">
                {isPickup ? 'Counter Handover Controls' : 'Delivery Dispatch Controls'}
              </h3>
            </div>

            {actionFeedback && (
              <div className="p-3 bg-white/15 border border-white/25 rounded-full text-xs text-white">
                {actionFeedback}
              </div>
            )}

            {actionError && (
              <div className="p-3 bg-white/15 border border-white/30 rounded-full text-xs text-[#FFF5F0]">
                {actionError}
              </div>
            )}

            <div className="space-y-4 text-xs">
              {!isPickup && (
                <div className="p-4 bg-white/10 border border-white/15 rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[#FFF5F0] uppercase tracking-wider text-[11px]">
                      Courier &amp; Tracking
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
                              `GS${order.orderNumber.replace(/[^A-Z0-9]/g, '')}`;
                            const autoCourier = courierName.trim() || 'Express Home Delivery';
                            setCourierName(autoCourier);
                            setTrackingNumber(autoAwb);
                            handleOwnerWorkflowUpdate('DISPATCHED', undefined, autoCourier, autoAwb);
                          }}
                          className="px-4 py-1.5 bg-white text-[#1F1C18] font-bold rounded-full cursor-pointer disabled:opacity-50"
                        >
                          Quick Dispatch (Auto Tracking)
                        </button>
                      )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#FCEAE3] mb-1">Courier Partner</label>
                      <input
                        type="text"
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        className="w-full px-4 py-2 rounded-full bg-[#1F1C18]/60 border border-white/20 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[#FCEAE3] mb-1">Tracking Number / AWB</label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder={`GS${order.orderNumber.replace(/[^A-Z0-9]/g, '')}`}
                        className="w-full px-4 py-2 rounded-full bg-[#1F1C18]/60 border border-white/20 text-white font-mono-tabular"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isPickup && !isCollected && !isCancelled && (
                <div className="p-4 bg-white/10 border border-white/15 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-white">Hand Over at Counter</p>
                    <input
                      type="text"
                      value={collectedByName}
                      onChange={(e) => setCollectedByName(e.target.value)}
                      placeholder={`Collected by (default: ${order.customerName})`}
                      className="w-full px-4 py-2 rounded-full bg-[#1F1C18]/60 border border-white/20 text-white placeholder-[#FCEAE3]/65"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleOwnerWorkflowUpdate('COLLECTED', 'PAID')}
                    className="px-5 py-2.5 bg-white text-[#1F1C18] font-bold rounded-full whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Mark Collected &amp; Paid ✓
                  </button>
                </div>
              )}

              {order.paymentStatus === 'PENDING' && order.orderStatus !== 'CANCELLED' && (
                <div className="p-4 bg-white/10 border border-white/15 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold text-[#FFF5F0]">
                      Pending Payment: {formatPaiseToINR(order.totalPaise)}
                    </p>
                    <input
                      type="text"
                      value={offlinePaymentRef}
                      onChange={(e) => setOfflinePaymentRef(e.target.value)}
                      placeholder="Cash / UPI reference (optional)"
                      className="w-full px-4 py-2 rounded-full bg-[#1F1C18]/60 border border-white/20 text-white placeholder-[#FCEAE3]/65"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleOwnerWorkflowUpdate(undefined, 'PAID')}
                    className="px-5 py-2.5 bg-white text-[#1F1C18] font-bold rounded-full whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Mark PAID
                  </button>
                </div>
              )}

              <div className="space-y-2.5">
                <input
                  type="text"
                  value={workflowNote}
                  onChange={(e) => setWorkflowNote(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full px-4 py-2 rounded-full bg-[#1F1C18]/60 border border-white/20 text-white placeholder-[#FCEAE3]/65"
                />

                <div className="flex flex-wrap items-center gap-2">
                  {!isPickup &&
                    allowedNextStatuses.map((nextSt) => (
                      <button
                        key={nextSt}
                        type="button"
                        disabled={updating}
                        onClick={() => handleOwnerWorkflowUpdate(nextSt, undefined)}
                        className="px-4 py-2 rounded-full font-semibold bg-white text-[#1F1C18] hover:bg-[#FDF2ED] cursor-pointer disabled:opacity-50"
                      >
                        Mark: {nextSt.replace(/_/g, ' ')}
                      </button>
                    ))}
                  {isPickup && !isCollected && !isCancelled && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleOwnerWorkflowUpdate('CANCELLED', undefined)}
                      className="px-4 py-2 rounded-full font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 cursor-pointer disabled:opacity-50"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="grid grid-cols-1 gap-4 pt-1">
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5C5349] flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#B44C2E]" />
              <span>Items in Order ({orderEntry.items?.length || 0})</span>
            </h3>
            <div className="liquid-glass-subtle rounded-3xl overflow-hidden divide-y divide-[#E8DFD5]/60 text-xs">
              {(orderEntry.items || []).map((it: any, idx: number) => (
                <div key={it.id || idx} className="p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#1F1C18]">
                      {it.quantity} × {it.productName}
                    </p>
                    <p className="text-[11px] text-[#5C5349] font-mono-tabular">
                      {it.variantName} · {formatPaiseToINR(it.unitPricePaise)} each
                    </p>
                  </div>
                  <span className="font-mono-tabular font-bold text-[#1F1C18] shrink-0">
                    {formatPaiseToINR(it.lineTotalPaise)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
