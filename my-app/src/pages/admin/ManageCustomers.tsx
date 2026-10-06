import {
  FiUsers,
  FiSearch,
  FiPhone,
  FiMail,
  FiShoppingBag,
  FiEye,
  FiEdit2,
  FiTrash2,
} from "react-icons/fi";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MetricGrid, { StatCard, ACCENT_COLORS } from "../../component/MetricGrid";

export default function ManageCustomers() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("shophub_user") || "null");
        const response = await fetch("/api/admin/customers", {
          headers: { Authorization: `Bearer ${user?.token || ""}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(data.message || "Could not load customers");
        setCustomers(data.customers || []);
      } catch (error) {
        console.error("Failed to load customers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const totalSpent = customers.reduce(
    (sum, customer) => sum + Number(customer.spent || 0),
    0,
  );
  const thisMonth = customers.filter((customer) => {
    const joined = new Date(customer.joined);
    const now = new Date();
    return (
      joined.getMonth() === now.getMonth() &&
      joined.getFullYear() === now.getFullYear()
    );
  }).length;
  const averageOrders = customers.length
    ? (
        customers.reduce(
          (sum, customer) => sum + Number(customer.orders || 0),
          0,
        ) / customers.length
      ).toFixed(1)
    : "0.0";

  const getToken = () =>
    JSON.parse(localStorage.getItem("shophub_user") || "null")?.token || "";

  const refreshCustomers = async () => {
    const response = await fetch("/api/admin/customers", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(data.message || "Could not load customers");
    setCustomers(data.customers || []);
  };

  const handleSave = async () => {
    if (!editingCustomer) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/customers/${editingCustomer.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            name: editingCustomer.name,
            email: editingCustomer.email,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.message || "Could not update customer");
      await refreshCustomers();
      setEditingCustomer(null);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Could not update customer",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: any) => {
    if (
      !window.confirm(
        `Delete customer ${customer.name}? Their orders will remain in the system.`,
      )
    )
      return;
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.message || "Could not delete customer");
      await refreshCustomers();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Could not delete customer",
      );
    }
  };

  if (loading)
    return (
      <div className="p-6 text-center text-slate-500">Loading customers...</div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Customer Management
        </h1>
        <p className="text-slate-600 mt-1">
          View and manage all registered customers
        </p>
      </div>

      {/* Stats Cards — uniform MetricGrid + StatCard */}
      <MetricGrid cols={4}>
        <StatCard label="Total Customers" value={customers.length} icon={<FiUsers size={20} />} accent={ACCENT_COLORS[0]} />
        <StatCard label="This Month" value={thisMonth} icon={<FiUsers size={20} />} accent={ACCENT_COLORS[3]} />
        <StatCard label="Total Spent" value={`Rs. ${totalSpent.toFixed(2)}`} icon={<FiShoppingBag size={20} />} accent={ACCENT_COLORS[1]} />
        <StatCard label="Avg. Orders" value={averageOrders} icon={<FiShoppingBag size={20} />} accent={ACCENT_COLORS[6]} />
      </MetricGrid>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex gap-4 items-center mb-6">
          <div className="flex-1 relative text-slate-900">
            <FiSearch
              className="absolute left-3 top-3 text-slate-900"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <select className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none">
            <option>All Cities</option>
            <option>Karachi</option>
            <option>Lahore</option>
            <option>Islamabad</option>
          </select>
        </div>

        {/* Customers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  Customer
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">
                  Contact
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  City
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Orders
                </th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">
                  Total Spent
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Joined
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {customer.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        ID: #{customer.id}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-slate-600 text-xs">
                        <FiMail size={14} /> {customer.email}
                      </p>
                      <p className="flex items-center gap-2 text-slate-600 text-xs">
                        <FiPhone size={14} /> {customer.phone || "Not provided"}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600">
                    {customer.city || "Not provided"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-slate-50 text-slate-700 px-3 py-1 rounded-full font-semibold">
                      {customer.orders}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                    Rs. {Number(customer.spent || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600 text-xs">
                    {new Date(customer.joined).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() =>
                          navigate(`/admin/customers/${customer.id}`)
                        }
                        className="p-2 bg-slate-600 text-white hover:text-slate-600 hover:bg-slate-50 border border-slate-200/60 rounded-lg transition"
                        title="View ledger"
                      >
                        <FiEye size={16} />
                      </button>
                      <button
                        onClick={() => setEditingCustomer({ ...customer })}
                        className="p-2 bg-emerald-600 text-white hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition"
                        title="Edit"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer)}
                        className="p-2 bg-red-600 text-white hover:bg-red-50 hover:text-red-600 rounded-lg transition"
                        title="Delete"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>

                    {(selectedCustomer || editingCustomer) && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                          <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold text-slate-900">
                              {editingCustomer
                                ? "Edit Customer"
                                : "Customer Details"}
                            </h2>
                            <button
                              onClick={() => {
                                setSelectedCustomer(null);
                                setEditingCustomer(null);
                              }}
                              className="text-slate-400 hover:text-slate-900 text-xl"
                            >
                              ×
                            </button>
                          </div>
                          {editingCustomer ? (
                            <div className="space-y-4">
                              <label className="block text-sm font-semibold text-slate-700">
                                Name
                                <input
                                  value={editingCustomer.name}
                                  onChange={(e) =>
                                    setEditingCustomer({
                                      ...editingCustomer,
                                      name: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                                />
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Email
                                <input
                                  type="email"
                                  value={editingCustomer.email}
                                  onChange={(e) =>
                                    setEditingCustomer({
                                      ...editingCustomer,
                                      email: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                                />
                              </label>
                              <div className="flex justify-end gap-3">
                                <button
                                  onClick={() => setEditingCustomer(null)}
                                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold"
                                >
                                  Cancel
                                </button>
                                <button
                                  disabled={saving}
                                  onClick={handleSave}
                                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                                >
                                  {saving ? "Saving..." : "Save Changes"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3 text-sm text-slate-600">
                              <p>
                                <strong className="text-slate-900">
                                  Name:
                                </strong>{" "}
                                {selectedCustomer.name}
                              </p>
                              <p>
                                <strong className="text-slate-900">
                                  Email:
                                </strong>{" "}
                                {selectedCustomer.email}
                              </p>
                              <p>
                                <strong className="text-slate-900">
                                  Phone:
                                </strong>{" "}
                                {selectedCustomer.phone || "Not provided"}
                              </p>
                              <p>
                                <strong className="text-slate-900">
                                  City:
                                </strong>{" "}
                                {selectedCustomer.city || "Not provided"}
                              </p>
                              <p>
                                <strong className="text-slate-900">
                                  Orders:
                                </strong>{" "}
                                {selectedCustomer.orders}
                              </p>
                              <p>
                                <strong className="text-slate-900">
                                  Total spent:
                                </strong>{" "}
                                Rs.{" "}
                                {Number(
                                  selectedCustomer.spent || 0,
                                ).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
