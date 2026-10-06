import { useState, useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FiGrid,
  FiBox,
  FiShoppingBag,
  FiUsers,
  FiArrowLeft,
  FiMenu,
  FiX,
  FiLogOut,
  FiBell,
  FiSettings,
  FiSearch,
  FiDollarSign,
  FiImage,
  FiLayers,
  FiFolder,
  FiTruck,
  FiShoppingCart,
  FiStar,
  FiRefreshCw,
  FiTag,
  FiPercent,
  FiPieChart,
  FiAward,
  FiZap,
  FiGlobe,
  FiMessageSquare,
  FiShield,
  FiNavigation,
  FiMapPin,
  FiCheckCircle,
  FiFileText,
} from 'react-icons/fi';
import { AdminAlertProvider } from '../context/AdminAlertContext';
import { NotificationProvider } from '../context/NotificationContext';
import NotificationBell from '../component/NotificationBell';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  // true = fully expanded (text+icons), false = collapsed (icons only on desktop)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authState, setAuthState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const { user, logout } = useAuth();
  const displayName = user?.name || 'Administrator';
  const initials = displayName.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const validateAdminSession = async () => {
      if (!user?.token || user.role !== 'admin') {
        if (!cancelled) setAuthState('denied');
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success || data.user?.role !== 'admin') {
          throw new Error(data.message || 'Your admin session is no longer valid.');
        }

        if (!cancelled) setAuthState('allowed');
      } catch (error) {
        console.error('Admin session validation failed:', error);
        if (!cancelled) {
          logout();
          setAuthState('denied');
        }
      }
    };

    validateAdminSession();
    return () => { cancelled = true; };
  }, [user?.token, user?.role, logout]);

  useEffect(() => {
    setIsMobileOpen(false);
    setSearchQuery('');
  }, [location.pathname]);

  const menuGroups: { label: string | null; items: { title: string; path: string; icon: React.ElementType; badge: string | null }[] }[] = [
    {
      label: null,
      items: [
        { title: 'Dashboard', path: '/admin', icon: FiGrid, badge: null },
        { title: 'Notifications', path: '/admin/notifications', icon: FiBell, badge: null },
      ],
    },
    {
      label: 'Catalog',
      items: [
        { title: 'Products', path: '/admin/products', icon: FiBox, badge: null },
        { title: 'Brands', path: '/admin/brands', icon: FiAward, badge: null },
        { title: 'Attributes', path: '/admin/attributes', icon: FiTag, badge: null },
        { title: 'Categories', path: '/admin/categories', icon: FiFolder, badge: null },
        { title: 'Collections', path: '/admin/collections', icon: FiLayers, badge: null },
      ],
    },
    {
      label: 'Orders & Sales',
      items: [
        { title: 'Orders', path: '/admin/orders', icon: FiShoppingBag, badge: null },
        { title: 'Returns & Refunds', path: '/admin/returns', icon: FiRefreshCw, badge: null },
        { title: 'Customers', path: '/admin/customers', icon: FiUsers, badge: null },
        { title: 'Contact Messages', path: '/admin/messages', icon: FiMessageSquare, badge: null },
        { title: 'Reviews & Ratings', path: '/admin/reviews', icon: FiStar, badge: null },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { title: 'Inventory & Ledger', path: '/admin/inventory', icon: FiBox, badge: null },
        { title: 'Suppliers', path: '/admin/suppliers', icon: FiTruck, badge: null },
        { title: 'Purchases', path: '/admin/purchases', icon: FiShoppingCart, badge: null },
      ],
    },
    {
      label: 'Logistics',
      items: [
        { title: 'Shipping & Couriers', path: '/admin/shipping', icon: FiMapPin, badge: null },
      ],
    },
    {
      label: 'Finance',
      items: [
        { title: 'COD Transactions', path: '/admin/finance/cod-transactions', icon: FiTruck, badge: null },
        { title: 'Courier Settlements', path: '/admin/finance/courier-settlements', icon: FiLayers, badge: null },
        { title: 'Reconciliation', path: '/admin/finance/reconciliation', icon: FiCheckCircle, badge: null },
        { title: 'COD Report', path: '/admin/finance/cod-report', icon: FiFileText, badge: null },
        { title: 'Transactions', path: '/admin/transactions', icon: FiDollarSign, badge: null },
        { title: 'Payment Recovery', path: '/admin/payment-recovery', icon: FiRefreshCw, badge: null },
      ],
    },
    {
      label: 'Promotions',
      items: [
        { title: 'Coupons & Discounts', path: '/admin/coupons', icon: FiTag, badge: null },
      ],
    },
    {
      label: 'Website',
      items: [
        { title: 'Banners', path: '/admin/banners', icon: FiImage, badge: null },
        { title: 'Navigation', path: '/admin/navigation', icon: FiNavigation, badge: null },
      ],
    },
    {
      label: 'Reports & Analytics',
      items: [
        { title: 'Reports & Analytics', path: '/admin/reports', icon: FiPieChart, badge: null },
      ],
    },
    {
      label: 'Administration',
      items: [
        { title: 'Staff & Roles', path: '/admin/staff', icon: FiShield, badge: null },
        { title: 'Settings', path: '/admin/settings', icon: FiSettings, badge: null },
      ],
    },
  ];

  const allMenuItems = menuGroups.flatMap(g => g.items);
  const filteredGroups = searchQuery
    ? [{ label: null as string | null, items: allMenuItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase())) }]
    : menuGroups;

  const currentPage = allMenuItems.find((item) => item.path === location.pathname);
  const pageTitle = currentPage?.title ?? 'Dashboard';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (authState === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-600">Checking admin session...</div>;
  }

  if (authState === 'denied') {
    return <Navigate to="/login" replace state={{ message: 'Please sign in with a valid administrator account.' }} />;
  }

  return (
    <AdminAlertProvider>
      <NotificationProvider>
        <div className="flex min-h-screen bg-white text-slate-900 font-sans antialiased">

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ─── SIDEBAR ─── */}
      <aside
        className={`
          shadow-[4px_0_20px_#0f172a03] sticky top-0 h-dvh hidden md:flex flex-col bg-white border-r border-slate-200 shrink-0
          transition-all duration-300 ease-in-out overflow-hidden
          ${isSidebarOpen ? 'w-64' : 'w-[68px]'}
        `}
      >
        {/* Brand */}
        <div className={`flex items-center border-b border-slate-200 shrink-0 ${isSidebarOpen ? 'px-5 py-4' : 'py-4 justify-center'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center font-black text-white shrink-0 text-lg">S</div>
            {isSidebarOpen && (
              <div className="whitespace-nowrap overflow-hidden">
                <span className="block font-bold text-base text-slate-900 tracking-tight leading-none">ShopHub</span>
                <span className="inline-block bg-slate-100 text-slate-900 text-[10px] font-extrabold tracking-wider px-1.5 py-0.5 rounded mt-1 border border-slate-300">ADMIN PANEL</span>
              </div>
            )}
          </div>
        </div>

        {isSidebarOpen && (
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus-within:border-black focus-within:ring-1 focus-within:ring-black">
              <FiSearch size={14} className="shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-slate-900 w-full"
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <div className={`flex-1 overflow-y-auto py-3 ${isSidebarOpen ? 'px-3' : 'px-2'}`}>
          <nav className="space-y-0.5">
            {filteredGroups.map((group, groupIdx) => (
              <div key={groupIdx} className={groupIdx > 0 ? 'mt-3' : ''}>
                {isSidebarOpen && group.label && (
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 px-3 pb-1.5 pt-0.5 uppercase">{group.label}</p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={!isSidebarOpen ? item.title : undefined}
                        className={`
                          min-h-11 flex items-center rounded-xl text-sm font-medium transition-all motion-reduce:transition-none group
                          ${isSidebarOpen ? 'px-3 py-2.5 gap-3 justify-between' : 'justify-center w-full'}
                          ${isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
                        `}
                      >
                        <span className={`
                          shrink-0 flex items-center justify-center transition-colors rounded-xl
                          ${isSidebarOpen ? 'p-1.5 rounded-lg' : 'w-10 h-10'}
                          ${isActive ? 'bg-transparent text-white' : 'bg-transparent text-slate-600 group-hover:text-slate-900'}
                        `}>
                          <Icon size={isSidebarOpen ? 15 : 18} />
                        </span>
                        {isSidebarOpen && <span className="flex-1 truncate">{item.title}</span>}
                        {isSidebarOpen && item.badge && (
                          <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${isActive ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}`}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className={`border-t border-slate-200 bg-slate-50 shrink-0 ${isSidebarOpen ? 'p-4 space-y-3' : 'py-3 px-2 space-y-2'}`}>
          {isSidebarOpen ? (
            <>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center font-bold text-xs text-white shrink-0">{initials}</div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 truncate">{displayName}</span>
                  <span className="block text-[10px] text-slate-500 truncate">Administrator</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Link to="/" className="bg-slate-900 text-white shadow-sm hover:bg-slate-800 transition-colors motion-reduce:transition-none flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold">
                  <FiArrowLeft size={14} /> Back to Shop
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-red-600 hover:bg-slate-100 transition text-left w-full">
                  <FiLogOut size={14} /> Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-slate-900 mx-auto flex items-center justify-center font-bold text-xs text-white" title={displayName}>{initials}</div>
              <Link to="/" title="Back to Shop" className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition mx-auto">
                <FiArrowLeft size={18} />
              </Link>
              <button onClick={handleLogout} title="Logout" className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-700 hover:text-red-600 hover:bg-slate-100 transition mx-auto">
                <FiLogOut size={18} />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ─── MOBILE SIDEBAR ─── */}
      <aside inert={!isMobileOpen} aria-label="Mobile navigation" className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col md:hidden transition-transform duration-300 ease-in-out shadow-2xl ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center font-black text-white text-lg">S</div>
            <div>
              <span className="block font-bold text-base text-slate-900 tracking-tight leading-none">ShopHub</span>
              <span className="inline-block bg-slate-100 text-slate-900 text-[10px] font-extrabold tracking-wider px-1.5 py-0.5 rounded mt-1 border border-slate-300">ADMIN PANEL</span>
            </div>
          </div>
          <button onClick={() => setIsMobileOpen(false)} aria-label="Close sidebar" className="p-1.5 text-slate-500 hover:text-black hover:bg-slate-100 rounded-lg transition">
            <FiX size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <nav className="space-y-0.5">
            {menuGroups.map((group, groupIdx) => (
              <div key={groupIdx} className={groupIdx > 0 ? 'mt-3' : ''}>
                {group.label && (
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 px-3 pb-1.5 pt-0.5 uppercase">{group.label}</p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                      <Link key={item.path} to={item.path} onClick={() => setIsMobileOpen(false)}
                        className={`min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all motion-reduce:transition-none group justify-between ${
                          isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}>
                        <div className="flex items-center gap-3">
                          <span className={`p-1.5 rounded-lg ${isActive ? 'bg-transparent text-white' : 'bg-slate-100 text-slate-700'}`}><Icon size={15} /></span>
                          <span>{item.title}</span>
                        </div>
                        {item.badge && <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${isActive ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'}`}>{item.badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-200 space-y-2 shrink-0">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center font-bold text-xs text-white shrink-0">{initials}</div>
            <div><span className="block text-xs font-bold text-slate-900">{displayName}</span><span className="block text-[10px] text-slate-500">Administrator</span></div>
          </div>
          <Link to="/" className="bg-slate-900 text-white shadow-sm hover:bg-slate-800 transition-colors motion-reduce:transition-none flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold"><FiArrowLeft size={14} /> Back to Shop</Link>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-red-600 hover:bg-slate-100 transition w-full"><FiLogOut size={14} /> Logout</button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white min-h-screen overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {/* Desktop: toggle expand/collapse */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex p-2 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 transition-all duration-200"
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isSidebarOpen ? <FiX size={19} /> : <FiMenu size={19} />}
            </button>
            {/* Mobile: open drawer */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              aria-label="Open sidebar"
            >
              <FiMenu size={19} />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 font-medium hidden sm:inline">Admin</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-bold text-slate-900 truncate">{pageTitle}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link to="/" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
              <FiArrowLeft size={13} /> View Store
            </Link>
            <NotificationBell />
            <Link to="/admin/settings" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition" title="Settings">
              <FiSettings size={18} />
            </Link>
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center font-bold text-xs text-white shadow-sm cursor-pointer">{initials}</div>
          </div>
        </header>
        {/* Page */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0 w-full">
          <div className="max-w-7xl mx-auto w-full has-[.admin-form-page]:max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </NotificationProvider>
    </AdminAlertProvider>
  );
}
