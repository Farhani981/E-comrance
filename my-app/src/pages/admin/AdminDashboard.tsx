import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiSun,
  FiDollarSign,
  FiShoppingBag,
  FiBox,
  FiUsers,
  FiTrendingUp,
  FiEye,
  FiTruck,
  FiCheckCircle,
  FiAlertTriangle,
  FiLayers,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { Chart, StatusDonut } from './AdminReports';
import MetricGrid, { StatCard, ACCENT_COLORS } from '../../component/MetricGrid';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [codStats, setCodStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const read = async (url: string) => {
      const response = await fetch(url, { signal: controller.signal, headers: { Authorization: `Bearer ${user?.token || ''}` } });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load dashboard.');
      return data;
    };
    Promise.all([
      read('/api/orders'),
      read('/api/admin/analytics/overview?range=last30&bucket=daily'),
      read('/api/admin/cod/stats').catch(() => ({ success: true, stats: null }))
    ])
      .then(([orderData, report, codData]) => {
        if (!controller.signal.aborted) {
          setOrders(orderData.orders || []);
          setAnalytics(report);
          if (codData?.stats) setCodStats(codData.stats);
          setError('');
        }
      })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.token, retry]);
  const summary = analytics?.summary.current;
  const statusRows = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded'].map(status => ({ status, orders: Number(analytics?.statuses.find((row: any) => row.status === status)?.orders || 0) }));

  // Key Metrics (accent colors auto-assigned by ACCENT_COLORS palette)
  const metricCards = [
    { label: 'Revenue (Last 30 Days)', value: `Rs. ${(summary?.revenue || 0).toLocaleString()}`, icon: <FiDollarSign size={20} />, sub: 'Live data' },
    { label: 'Orders (Last 30 Days)', value: String(summary?.orders || 0), icon: <FiShoppingBag size={20} />, sub: 'Live data' },
    { label: 'Current Products', value: String(analytics?.summary.inventory.products || 0), icon: <FiBox size={20} />, sub: 'Live data' },
    { label: 'Total Customers', value: String(summary?.total_customers || 0), icon: <FiUsers size={20} />, sub: 'Live data' },
  ];

  // Recent Orders
  const recentOrders = orders.slice(0, 5).map(order => ({
    id: order.id,
    customer: order.customer_name,
    date: new Date(order.created_at).toLocaleDateString(),
    amount: `Rs. ${Number(order.total_amount || 0).toLocaleString()}`,
    status: order.order_status || 'Pending',
    items: order.items?.reduce((total: number, item: any) => total + Number(item.quantity || 0), 0) || 0,
  }));

  // Top Products
  const topProducts = [
    { name: 'Premium Wireless Headphones', sales: 156, revenue: 'Rs. 234,000', stock: 45 },
    { name: 'Smart Watch Pro', sales: 128, revenue: 'Rs. 384,000', stock: 32 },
    { name: 'USB-C Cable 2M', sales: 298, revenue: 'Rs. 89,400', stock: 150 },
    { name: 'Phone Case Leather', sales: 187, revenue: 'Rs. 56,100', stock: 78 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered':
      case 'Completed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'Processing': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'Shipped': return 'bg-violet-50 text-violet-700 border border-violet-200';
      case 'Pending': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'Cancelled': return 'bg-red-50 text-red-700 border border-red-200';
      default: return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="admin-overview space-y-8 pb-8 bg-white">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-start">
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><FiSun size={20} aria-hidden="true" /> Good Morning</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{user?.name || 'Administrator'}</h1>
          <p className="text-slate-600 mt-1">Welcome back! Here's your business performance.</p>
        </div>
        <div className="text-sm text-slate-500">
          Last updated: {new Date().toLocaleDateString('en-PK')}
        </div>
      </div>

      {loading && <p role="status" className="rounded-xl bg-blue-50 p-5 text-blue-800">Loading dashboard...</p>}
      {error && <div role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">{error} <button onClick={() => { setLoading(true); setError(''); setRetry(value => value + 1); }} className="ml-3 underline">Retry</button></div>}
      {!loading && !error && analytics && <>
      <p className="text-sm text-slate-500">Analytics: {analytics.period.start} through {analytics.period.end}. Revenue excludes cancelled orders and recorded refunds; it is not cash collected.</p>
      {summary?.unknown_currency_orders > 0 && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{summary.unknown_currency_orders} orders have unknown currency and are excluded from revenue. Order counts still include them.</p>}
      {/* Key Metrics Cards — uniform via shared MetricGrid + StatCard */}
      <MetricGrid cols={4}>
        {metricCards.map((card, idx) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            sub={card.sub}
            accent={ACCENT_COLORS[idx % ACCENT_COLORS.length]}
          />
        ))}
      </MetricGrid>

      {/* COD & Courier Settlement Summary Section */}
      {codStats && (
        <div className="bg-slate-50/70 border border-slate-200 rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-black text-white rounded-xl">
                <FiTruck size={18} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">COD & Courier Settlement Overview</h3>
                <p className="text-xs text-slate-500">Real-time Cash on Delivery volume, pending remittances, and settlement balance</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <Link
                to="/admin/finance/cod-transactions"
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 transition"
              >
                COD Transactions
              </Link>
              <Link
                to="/admin/finance/courier-settlements"
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 transition"
              >
                Settlements
              </Link>
              <Link
                to="/admin/finance/reconciliation"
                className="px-3 py-1.5 bg-black hover:bg-slate-800 text-white rounded-xl transition"
              >
                Reconciliation
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total COD Volume</span>
              <span className="text-base font-black text-slate-900 block mt-0.5">Rs. {(codStats.codAmount || 0).toLocaleString()}</span>
              <span className="text-[11px] text-slate-500">{codStats.totalCodOrders} orders placed</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Collected by Courier</span>
              <span className="text-base font-black text-blue-900 block mt-0.5">Rs. {(codStats.collectedByCourier || 0).toLocaleString()}</span>
              <span className="text-[11px] text-blue-600 font-medium">Delivered at doorstep</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Settlement Pending</span>
              <span className="text-base font-black text-amber-900 block mt-0.5">Rs. {(codStats.settlementPending || 0).toLocaleString()}</span>
              <span className="text-[11px] text-amber-600 font-medium">Awaiting remittance</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Settled & Reconciled</span>
              <span className="text-base font-black text-emerald-900 block mt-0.5">Rs. {(codStats.settledAmount || 0).toLocaleString()}</span>
              <span className="text-[11px] text-emerald-600 font-medium">Rec: Rs. {(codStats.reconciledAmount || 0).toLocaleString()}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Net Discrepancies</span>
              <span className={`text-base font-black block mt-0.5 ${codStats.totalDiscrepancy > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {codStats.totalDiscrepancy > 0 ? `Rs. ${(codStats.totalDiscrepancy || 0).toLocaleString()}` : 'Rs. 0'}
              </span>
              <span className={`text-[11px] font-medium ${codStats.discrepancyCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {codStats.discrepancyCount > 0 ? `⚠️ ${codStats.discrepancyCount} items flagged` : '✅ Fully balanced'}
              </span>
            </div>
          </div>
        </div>
      )}

      <Chart rows={analytics.chart} type="overview" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Donut */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
            <FiShoppingBag className="w-5 h-5 text-slate-600" />
            Order Status Summary
          </h3>
          <p className="mb-4 text-xs text-slate-500">Last 30 days. Completed orders are included in Delivered.</p>
          <StatusDonut rows={statusRows} />
        </div>

        {/* Top Products */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <FiBox className="w-5 h-5 text-slate-600" />
              Top Selling Products
            </h3>
            <a href="/admin/products" className="text-sm text-slate-600 hover:text-slate-700 font-medium">
              View All
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Product Name</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Sales</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Revenue</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Stock</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-700 font-medium">{product.name}</td>
                    <td className="text-center py-3 px-4 text-slate-600">{product.sales}</td>
                    <td className="text-center py-3 px-4 font-semibold text-emerald-600">{product.revenue}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${product.stock > 50 ? 'bg-emerald-50 text-emerald-700' :
                          product.stock > 20 ? 'bg-slate-50 text-slate-700' :
                            'bg-red-50 text-red-700'
                        }`}>
                        {product.stock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <FiTrendingUp className="w-5 h-5 text-emerald-600" />
            Recent Orders
          </h3>
          <a href="/admin/orders" className="text-sm text-slate-600 hover:text-slate-700 font-medium flex items-center gap-1">
            <FiEye className="w-4 h-4" /> View All
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Order ID</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Customer</th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">Date</th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">Items</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">Amount</th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900">{order.id}</td>
                  <td className="py-3 px-4 text-slate-700">{order.customer}</td>
                  <td className="py-3 px-4 text-center text-slate-600 text-xs">{order.date}</td>
                  <td className="py-3 px-4 text-center text-slate-600">{order.items}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">{order.amount}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </div>
  );
}
