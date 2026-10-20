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
} from 'lucide-react';

interface OrderTrackingTimelineProps {
  orderEntry: any;
  isOwnerOrStaff?: boolean;
  idToken?: string | null;
  onOrderUpdated?: (updatedOrderEntry?: any) => void;
  onSwitchToOwnerRole?: () => void;
}

const STORE_PICKUP_STAGES: Array<{
  status: OrderStatus;
  label: string;
  sublabel: string;
}> = [
  { status: 'ORDER_PLACED', label: 'Order Placed', sublabel: 'Stock reserved online' },
  { status: 'CONFIRMED', label: 'Confirmed', sublabel: 'Verified by store desk' },
  { status: 'PREPARING', label: 'Preparing Bag', sublabel: 'Items being packed' },
  { status: 'READY_FOR_PICKUP', label: 'Ready at Counter', sublabel: 'Show Pickup Code at store' },
  { status: 'COLLECTED', label: 'Collected', sublabel: 'Handed over to customer' },
];

const HOME_DELIVERY_STAGES: Array<{
  status: OrderStatus;
  label: string;
  sublabel: string;
}> = [
  { status: 'ORDER_PLACED', label: 'Order Placed', sublabel: 'Stock reserved online' },
  { status: 'CONFIRMED', label: 'Confirmed', sublabel: 'Verified for dispatch' },
  { status: 'PROCESSING', label: 'Processing', sublabel: 'Items picked from shelf' },
  { status: 'PACKED', label: 'Packed', sublabel: 'Carton sealed & billed' },
  { status: 'DISPATCHED', label: 'Dispatched', sublabel: 'Handed to courier partner' },
  { status: 'DELIVERED', label: 'Delivered', sublabel: 'Completed at address' },
];

export const OrderTrackingTimeline: React.FC<OrderTrackingTimelineProps> = ({
  orderEntry,
  isOwnerOrStaff = false,
  idToken,
  onOrderUpdated,
  onSwitchToOwnerRole,
}) => {
  const [workflowNote, setWorkflowNote] = useState('');
  const [courierName, setCourierName] = useState(
    orderEntry?.shipmentDetails?.courierName || ''
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
  const stages = isPickup ? STORE_PICKUP_STAGES : HOME_DELIVERY_STAGES;
  const isCancelled = order.orderStatus === 'CANCELLED';

  // Find current stage index
  const currentStageIndex = stages.findIndex((s) => s.status === order.orderStatus);

  const allowedNextStatuses = getAllowedNextOrderStatuses(
    order.fulfilmentMethod as FulfilmentMethod,
    order.orderStatus as OrderStatus
  );

  const handleOwnerWorkflowUpdate = async (
    nextOrderStatus?: OrderStatus,
    nextPaymentStatus?: 'PENDING' | 'PAID' | 'REFUNDED'
  ) => {
    setUpdating(true);
    setActionError(null);
    setActionFeedback(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
      const res = await fetch(`/api/admin/orders/${order.id}/update-workflow`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nextOrderStatus,
          nextPaymentStatus,
          note: workflowNote || undefined,
          courierName: courierName || undefined,
          trackingNumber: trackingNumber || undefined,
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
            <span className="font-semibold uppercase tracking-wider text-stone-800">
              {isPickup ? 'Store Pickup Order' : 'Home Delivery Order'}
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
              Current Stage
            </span>
            <span
              className={`font-mono-tabular text-sm sm:text-base font-bold ${
                isCancelled
                  ? 'text-red-700'
                  : order.orderStatus === 'COLLECTED' || order.orderStatus === 'DELIVERED'
                  ? 'text-emerald-800'
                  : 'text-[#B42318]'
              }`}
            >
              {order.orderStatus.replace(/_/g, ' ')}
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
        ) : (
          /* Visual Multi-Stage Progress Stepper (Vertical on Mobile, Horizontal on Desktop) */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-600 mb-3">
              <span className="font-semibold text-stone-900">
                Live Fulfilment Progress ({isPickup ? 'Store Counter Pickup' : 'Doorstep Delivery'})
              </span>
              <span className="font-mono-tabular">
                Step {Math.max(1, currentStageIndex + 1)} of {stages.length}
              </span>
            </div>

            {/* Desktop Horizontal Stepper (md and up) */}
            <div className="hidden md:grid md:grid-cols-5 lg:grid-cols-6 gap-2.5">
              {stages.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                const isDoneFinal =
                  isCurrent &&
                  (stage.status === 'COLLECTED' || stage.status === 'DELIVERED');
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
              {stages.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                const isDoneFinal =
                  isCurrent &&
                  (stage.status === 'COLLECTED' || stage.status === 'DELIVERED');
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

        {/* Store Pickup Details OR Home Delivery Shipment Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {orderEntry.pickupDetails && (
            <div className="p-5 bg-amber-50/80 border border-amber-200 rounded-3xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                  <Store className="w-4 h-4 text-[#B42318] shrink-0" />
                  <span>Store Pickup Counter Pass</span>
                </div>
                <span className="font-mono-tabular font-bold text-sm px-3 py-1 bg-white border border-amber-300 rounded-full text-stone-900">
                  Code: {orderEntry.pickupDetails.pickupCode}
                </span>
              </div>
              <p className="text-amber-900">
                <strong>Preferred Slot:</strong> {orderEntry.pickupDetails.preferredWindow}
              </p>
              <p className="text-amber-800">{orderEntry.pickupDetails.storeLocationNote}</p>
              {orderEntry.pickupDetails.readyAt && (
                <p className="text-emerald-800 font-semibold">
                  Marked Ready at Counter:{' '}
                  {new Date(orderEntry.pickupDetails.readyAt).toLocaleString('en-IN')}
                </p>
              )}
              {orderEntry.pickupDetails.collectedAt && (
                <p className="text-emerald-900 font-bold border-t border-amber-200 pt-1.5">
                  Collected by {orderEntry.pickupDetails.collectedByName || order.customerName} on{' '}
                  {new Date(orderEntry.pickupDetails.collectedAt).toLocaleString('en-IN')} (Verified by{' '}
                  {orderEntry.pickupDetails.verifiedByStaffEmail})
                </p>
              )}
            </div>
          )}

          {orderEntry.shipmentDetails && (
            <div className="p-5 bg-stone-50 border border-stone-200 rounded-3xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <Truck className="w-4 h-4 text-stone-800 shrink-0" />
                  <span>Home Delivery Dispatch Details</span>
                </div>
                <span className="font-mono-tabular font-semibold text-stone-700">
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
                <div className="p-3 bg-white border border-stone-200 rounded-2xl font-mono-tabular text-stone-900">
                  <p className="font-bold">
                    Courier: {orderEntry.shipmentDetails.courierName || 'Surface Courier'} · AWB / Tracking #:{' '}
                    {orderEntry.shipmentDetails.trackingNumber}
                  </p>
                  {orderEntry.shipmentDetails.dispatchedAt && (
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Dispatched: {new Date(orderEntry.shipmentDetails.dispatchedAt).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-stone-500 italic">
                  Courier & AWB tracking number will appear here once the parcel is dispatched.
                </p>
              )}
            </div>
          )}

          {/* Payment & Invoice Breakdown Summary */}
          <div className="p-5 bg-stone-50 border border-stone-200 rounded-3xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                <CreditCard className="w-4 h-4 text-stone-800 shrink-0" />
                <span>Payment & GST Summary</span>
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
                <span>Shipping / Fulfilment Fee</span>
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

        {/* STORE OWNER / STAFF LIVE TRACKING & WORKFLOW CONTROL PANEL (Only rendered for authorised staff/owners) */}
        {isOwnerOrStaff && (
          <div className="p-5 sm:p-6 bg-slate-900 text-white rounded-[32px] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold tracking-wide uppercase">
                  Store Owner & Counter Staff Tracking Controls
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
              {/* Courier & Tracking Inputs for Home Delivery */}
              {!isPickup && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Courier Partner Name (for Dispatch)
                    </label>
                    <input
                      type="text"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      placeholder="e.g. Delhivery / BlueDart / India Post"
                      className="w-full px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">
                      AWB / Consignment Tracking Number
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. DLV98234120IN"
                      className="w-full px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-white font-mono-tabular placeholder-slate-400"
                    />
                  </div>
                </div>
              )}

              {/* Store Pickup Collector Input */}
              {isPickup && order.orderStatus === 'READY_FOR_PICKUP' && (
                <div>
                  <label className="block text-slate-300 mb-1">
                    Collected at Counter By (Customer / Representative Name)
                  </label>
                  <input
                    type="text"
                    value={collectedByName}
                    onChange={(e) => setCollectedByName(e.target.value)}
                    placeholder={`e.g. ${order.customerName} (Pickup Code Verified)`}
                    className="w-full px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400"
                  />
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
                  placeholder="Add owner / staff tracking note (visible in audit log)..."
                  className="w-full px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400"
                />

                <div className="flex flex-wrap items-center gap-2">
                  {allowedNextStatuses.map((nextSt) => (
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
                  ))}

                  {!isPickup && (courierName || trackingNumber) && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleOwnerWorkflowUpdate(undefined, undefined)}
                      className="px-4 py-2 rounded-full font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer disabled:opacity-50"
                    >
                      Save Courier / Tracking Info
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

        {/* Ordered Items & Timestamped Activity History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
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

          {/* Audit & Tracking Activity Log */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-stone-600" />
              <span>Timestamped Order Tracking Log</span>
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
        </div>
      </div>
    </div>
  );
};
