import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiTruck,
  FiEye,
  FiSearch,
  FiX,
  FiMapPin,
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiPackage,
  FiRefreshCw,
} from "react-icons/fi";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import MetricGrid, { StatCard, ACCENT_COLORS } from "../../component/MetricGrid";

export default function ManageOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { user } = useAuth();
  const authToken = user?.token || "";

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const message = [401, 403].includes(res.status)
          ? "Your admin session is invalid or expired. Please sign in again."
          : data.message || `Could not load orders (HTTP ${res.status}).`;
        throw new Error(message);
      }
      setOrders(data.orders || []);
    } catch (err) {
      console.error(err);
      setOrders([]);
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the orders API.",
      );
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ order_status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        if (!data.emailSent) {
          window.alert(
            "Order status updated, but the customer email was not accepted by the mail server.",
          );
        }
        fetchOrders();
      } else {
        window.alert(data.message || "Could not update order status.");
      }
    } catch (err) {
      console.error(err);
      window.alert(
        err instanceof Error
          ? err.message
          : "Could not update the order status.",
      );
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "All" || o.order_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const orderStatusSummary = [
    {
      label: "Pending",
      count: orders.filter((order) => order.order_status === "Pending").length,
      icon: FiClock,
      styles: "border-amber-200 bg-white text-slate-700",
      iconStyles: "bg-amber-100 text-amber-600",
    },
    {
      label: "Processing",
      count: orders.filter((order) => order.order_status === "Processing")
        .length,
      icon: FiPackage,
      styles: "border-blue-200 bg-white text-slate-700",
      iconStyles: "bg-blue-100 text-blue-600",
    },
    {
      label: "Shipped",
      count: orders.filter((order) => order.order_status === "Shipped").length,
      icon: FiTruck,
      styles: "border-purple-200 bg-white text-slate-700",
      iconStyles: "bg-purple-100 text-purple-600",
    },
    {
      label: "Delivered",
      count: orders.filter((order) =>
        ["Delivered", "Completed"].includes(order.order_status),
      ).length,
      icon: FiCheckCircle,
      styles: "border-emerald-200 bg-white text-emerald-700",
      iconStyles: "bg-emerald-100 text-emerald-700",
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "Delivered":
      case "Completed":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "Pending":
        return "bg-slate-50 text-slate-700 border border-slate-200";
      case "Processing":
        return "bg-slate-50 text-slate-700 border border-slate-200";
      case "Shipped":
        return "bg-slate-50 text-slate-700 border border-slate-200";
      case "Cancelled":
        return "bg-red-50 text-red-700 border border-red-200";
      default:
        return "bg-slate-50 text-slate-700 border border-slate-200";
    }
  };

  if (loading)
    return (
      <div className="p-6 text-center text-slate-500">Loading Orders...</div>
    );

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <FiAlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-3 text-xl font-bold text-red-900">
          Orders could not be loaded
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={fetchOrders}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700"
        >
          <FiRefreshCw /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Order Management</h1>
        <p className="text-slate-600 mt-1">
          View and manage all customer orders
        </p>
      </div>

      {/* Stats Cards — uniform MetricGrid + StatCard */}
      <MetricGrid cols={4}>
        {orderStatusSummary.map(({ label, count, icon: Icon }, idx) => (
          <StatCard
            key={label}
            label={`${label} Orders`}
            value={count}
            icon={<Icon size={20} />}
            accent={ACCENT_COLORS[idx % ACCENT_COLORS.length]}
          />
        ))}
      </MetricGrid>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex gap-4 items-center mb-6 flex-wrap">
          <div className="flex-1 min-w-64 relative text-slate-900">
            <FiSearch
              className="absolute left-3 top-3 text-slate-900"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by order ID or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none text-slate-900"
          >
            <option>All</option>
            <option>Pending</option>
            <option>Processing</option>
            <option>Shipped</option>
            <option>Delivered</option>
            <option>Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  Order ID
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  Customer
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Date
                </th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">
                  Amount
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Status
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {order.id}
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        {order.customer_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {order.address}, {order.city}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600 text-xs">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                    Rs. {order.total_amount}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <select
                      value={order.order_status}
                      onChange={(e) =>
                        handleStatusChange(order.id, e.target.value)
                      }
                      className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${getStatusColor(order.order_status)}`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 rounded-lg bg-blue-600 text-white transition-all hover:bg-blue-200 hover:text-slate-900"
                        title="View Order Details"
                      >
                        <FiEye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    {orders.length === 0
                      ? "No orders are stored in the connected database."
                      : "No orders match the current search or status filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
            <div className="bg-slate-50 px-6 py-5 text-slate-900 sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Order Details
                  </p>
                  <h2 className="text-2xl font-bold">{selectedOrder.id}</h2>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <FiCalendar size={13} />{" "}
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                    {selectedOrder.order_status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                    aria-label="Close order details"
                  >
                    <FiX size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(90vh-116px)] overflow-y-auto p-5 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <FiUser size={14} /> Customer
                  </div>
                  <p className="font-bold text-slate-900">
                    {selectedOrder.customer_name}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <FiMail size={14} /> {selectedOrder.email}
                  </p>
                  {selectedOrder.phone && (
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                      <FiPhone size={14} /> {selectedOrder.phone}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <FiMapPin size={14} /> Delivery Address
                  </div>
                  <p className="text-sm leading-6 text-slate-700">
                    {selectedOrder.address || "Address not provided"}
                    {selectedOrder.city ? `, ${selectedOrder.city}` : ""}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Payment:{" "}
                    <span className="text-slate-800">
                      {selectedOrder.payment_method || "Cash on Delivery"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Items Ordered
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {selectedOrder.items?.length || 0} item(s)
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {(selectedOrder.items || []).map((item, index) => (
                    <div
                      key={item.id || `${item.product_name}-${index}`}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <img
                        src={item.image || "https://via.placeholder.com/64"}
                        alt={item.product_name || "Product"}
                        className="h-14 w-14 rounded-xl border border-slate-200 bg-slate-50 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {item.product_name || "Product"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Qty {item.quantity} x Rs.{" "}
                          {Number(item.price || 0).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        Rs.{" "}
                        {(
                          Number(item.price || 0) * Number(item.quantity || 0)
                        ).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-2xl bg-emerald-50 px-5 py-4 ring-1 ring-emerald-100">
                <span className="text-sm font-semibold text-emerald-800">
                  Order Total
                </span>
                <span className="text-2xl font-black text-emerald-700">
                  Rs. {Number(selectedOrder.total_amount || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
