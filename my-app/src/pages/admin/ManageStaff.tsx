import React, { useEffect, useState, useCallback } from 'react';
import {
  FiUsers,
  FiShield,
  FiFileText,
  FiUserPlus,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiClock,
  FiMail,
  FiKey,
  FiCheckCircle
} from 'react-icons/fi';
import MetricGrid, { StatCard } from '../../component/MetricGrid';
import { useAdminAlert } from '../../context/AdminAlertContext';
import { useAuth } from '../../context/AuthContext';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: string;
  assignedRole: string;
  status: string;
  created_at: string;
}

interface RoleDefinition {
  role: string;
  name: string;
  description: string;
  permissions: string[];
}

interface ActivityLog {
  id: number;
  admin_name: string;
  action: string;
  module: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export default function ManageStaff() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();

  const [activeTab, setActiveTab] = useState<'staff' | 'roles' | 'logs'>('staff');
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    password: '',
    role: 'store_manager',
  });

  const fetchStaffData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff', {
        headers: { Authorization: `Bearer ${user?.token || ''}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStaff(data.staff || []);
        setRoles(data.roles || []);
        setLogs(data.logs || []);
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  }, [user?.token, showAlert]);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token || ''}`,
        },
        body: JSON.stringify(newStaff),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert('New staff account created successfully.', 'success', 'Staff Added');
        setIsAddingStaff(false);
        setNewStaff({ name: '', email: '', password: '', role: 'store_manager' });
        fetchStaffData();
      } else {
        throw new Error(data.message || 'Failed to create staff account.');
      }
    } catch (err: any) {
      showAlert(err.message, 'error', 'Creation Error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <FiShield className="text-amber-500" /> Admin & Staff Access Control
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage admin users, team permissions matrix, and audit activity logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingStaff(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition shadow-sm"
          >
            <FiUserPlus /> Add Staff Member
          </button>
          <button
            onClick={fetchStaffData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition shadow-sm"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <MetricGrid cols={3}>
        <StatCard
          label="Registered Staff"
          value={String(staff.length)}
          icon={<FiUsers size={20} />}
          sub="Authorized personnel"
          accent="blue"
        />
        <StatCard
          label="Role Profiles"
          value={String(roles.length)}
          icon={<FiShield size={20} />}
          sub="Configured permission levels"
          accent="amber"
        />
        <StatCard
          label="Audit Activity Logs"
          value={String(logs.length)}
          icon={<FiFileText size={20} />}
          sub="Logged administrative events"
          accent="purple"
        />
      </MetricGrid>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'staff'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiUsers /> Team Members ({staff.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'roles'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiShield /> Roles & Permissions ({roles.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'border-black text-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FiFileText /> Activity Audit Trail ({logs.length})
        </button>
      </div>

      {/* Tab 1: Staff Users */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">User</th>
                  <th className="py-3 px-4 font-bold">Email</th>
                  <th className="py-3 px-4 font-bold">Assigned Role</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white font-extrabold flex items-center justify-center text-sm">
                          {u.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="font-bold text-slate-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-xs">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-xs px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                        {u.assignedRole}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Roles Matrix */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roles.map((r) => (
            <div key={r.role} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <FiShield className="text-amber-500" /> {r.name}
                  </h3>
                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                    {r.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">{r.description}</p>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">Permissions Granted:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {r.permissions.map((p) => (
                      <span key={p} className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-md shadow-2xs">
                        {p === 'all' ? 'All Permissions (Super Admin)' : p.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 mt-4 text-xs font-bold text-slate-400">
                System Role Defined
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Activity Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Administrative Audit Trail</h3>
            <span className="text-xs text-slate-400">Chronological system security events</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">Timestamp</th>
                  <th className="py-3 px-4 font-bold">Admin Member</th>
                  <th className="py-3 px-4 font-bold">Action</th>
                  <th className="py-3 px-4 font-bold">Module</th>
                  <th className="py-3 px-4 font-bold">Event Details</th>
                  <th className="py-3 px-4 font-bold text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-slate-500 text-xs font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{log.admin_name}</td>
                    <td className="py-3 px-4 font-mono text-xs font-bold text-amber-700">
                      {log.action}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">
                        {log.module}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs max-w-sm truncate">{log.details}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-xs text-right">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddingStaff && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Provision Staff Account</h3>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ali Ahmed"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="ali@shophub.com"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Assigned Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black"
                >
                  <option value="store_manager">Store Manager</option>
                  <option value="order_fulfillment">Order & Shipping Staff</option>
                  <option value="inventory_specialist">Inventory Specialist</option>
                  <option value="super_admin">Super Administrator</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingStaff(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-black text-white font-bold text-xs hover:bg-slate-800 transition"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
