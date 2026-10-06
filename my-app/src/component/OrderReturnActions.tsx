import { useEffect, useState } from "react";
import {
  operationsRequest as request,
  buttonClass,
  secondaryClass,
  inputClass,
  money,
} from "../pages/admin/operationsShared";
type ReturnRecord = {
  order_id: string;
  status: string;
  refund_amount: string;
  refund_reference: string;
};
export default function OrderReturnActions({
  order,
  onCancelled,
}: {
  order: { id: string; order_status: string };
  onCancelled: () => void;
}) {
  const [record, setRecord] = useState<ReturnRecord | null>(null),
    [open, setOpen] = useState(false),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    request("/operations/my-returns")
      .then((data) => {
        if (!cancelled)
          setRecord(
            data.returns.find((r: ReturnRecord) => r.order_id === order.id) ||
              null,
          );
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Request failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order.id, order.order_status]);
  async function submit(cancel: boolean) {
    setBusy(true);
    setError("");
    try {
      await request(
        cancel
          ? `/operations/orders/${order.id}/cancel`
          : "/operations/my-returns",
        {
          method: "POST",
          body: JSON.stringify({ order_id: order.id, reason }),
        },
      );
      if (cancel) onCancelled();
      else {
        setRecord({
          order_id: order.id,
          status: "Requested",
          refund_amount: "0",
          refund_reference: "",
        });
        setOpen(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {record ? (
        <p className="text-sm font-semibold text-slate-700">
          Return: {record.status}
          {record.status === "Refunded"
            ? ` · Refund ${money(record.refund_amount)} · ${record.refund_reference}`
            : ""}
        </p>
      ) : (
        !loading &&
        ["Delivered", "Completed"].includes(order.order_status) && (
          <button className={secondaryClass} onClick={() => setOpen(!open)}>
            Request a return
          </button>
        )
      )}
      {["Pending", "Processing"].includes(order.order_status) && (
        <button
          className={secondaryClass}
          disabled={busy}
          onClick={() => {
            if (window.confirm("Cancel this order?")) void submit(true);
          }}
        >
          Cancel order
        </button>
      )}
      {open && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          <label className="block text-sm font-semibold">
            Reason for returning the whole order
            <textarea
              required
              maxLength={1000}
              rows={3}
              className={`${inputClass} mt-2`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button disabled={busy} className={buttonClass}>
            Submit return request
          </button>
        </form>
      )}
    </div>
  );
}
