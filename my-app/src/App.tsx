import PaymentRecovery from './pages/admin/PaymentRecovery';
import StoreMetadata from './component/StoreMetadata';
import ContactMessages from './pages/admin/ContactMessages';
import { useEffect } from 'react';
import { Routes, Route, useLocation, Outlet, Navigate } from 'react-router-dom';
import Navbar from './component/Navbar.jsx';
import Hero from './component/Hero.jsx';
import Categories from './component/categories.jsx';
import FeaturedProducts from './component/FeaturedProducts.jsx';
import PromoSection from './component/PromoSection.jsx';
import CustomerReviews from './component/CustomerReviews.jsx';
import './component/PromoReviews.css';
import AdminLayout from './layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageProducts from './pages/admin/ManageProducts';
import ManageBanners from './pages/admin/ManageBanners';
import ManageCategories from './pages/admin/ManageCategories';
import ManageCollections from './pages/admin/ManageCollections';
import ManageOrders from './pages/admin/ManageOrders';
import ManageCustomers from './pages/admin/ManageCustomers';
import CustomerDetails from './pages/admin/CustomerDetails';
import ManageSuppliers from './pages/admin/ManageSuppliers';
import ManagePurchases from './pages/admin/ManagePurchases';
import ManageInventory from './pages/admin/ManageInventory';
import ManageAttributes from './pages/admin/ManageAttributes';
import ManageReviews from './pages/admin/ManageReviews';
import ManageReturns from './pages/admin/ManageReturns';
import ManageCoupons from './pages/admin/ManageCoupons';
import Transactions from './pages/admin/Transactions';
import SystemSettings from './pages/admin/SystemSettings';
import AdminReports from './pages/admin/AdminReports';
import ManageShipping from './pages/admin/ManageShipping';
import AdminNotifications from './pages/admin/AdminNotifications';
import ManageStaff from './pages/admin/ManageStaff';
import ManageBrands from './pages/admin/ManageBrands';
import ManageNavigation from './pages/admin/ManageNavigation';
import CODTransactions from './pages/admin/CODTransactions';
import CourierSettlements from './pages/admin/CourierSettlements';
import CODReconciliation from './pages/admin/CODReconciliation';
import CODSettlementReport from './pages/admin/CODSettlementReport';

import Footer from './component/Footer.jsx';
import LogoCarousel from './component/LogoCarousel.jsx';
import WhatsAppButton from './component/WhatsAppButton.jsx';
// Pages import 
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import Shop from './pages/Shop';
import Login from './pages/login';
import Account from './pages/Account';
import Orders from './pages/Orders';
import About from './pages/About';
import Contact from './pages/Contact';
import Faq from './pages/Faq';
import Policies from './pages/Policies';
import NotFound from './pages/NotFound';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Home Component  
function Home() {
  return (
    <>
      <Hero />
      <Categories />
      <FeaturedProducts />
      <PromoSection />
      <CustomerReviews />
      <LogoCarousel />
    </>
  );
}

// User Layout Component (Strictly for Public Pages)
function UserLayout() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-white text-slate-900">
      <StoreMetadata />
      <Navbar />
      <main className="grow">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* 1. Public Routes WITH Navbar & Footer */}
        <Route element={<UserLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/products" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* 2. Admin Routes   */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<ManageProducts />} />
          <Route path="banners" element={<ManageBanners />} />
          <Route path="categories" element={<ManageCategories />} />
          <Route path="collections" element={<ManageCollections />} />
          <Route path="orders" element={<ManageOrders />} />
          <Route path="messages" element={<ContactMessages />} />
          <Route path="customers" element={<ManageCustomers />} />
          <Route path="customers/:id" element={<CustomerDetails />} />
            <Route path="suppliers" element={<ManageSuppliers />} />
          <Route path="purchases" element={<ManagePurchases />} />
          <Route path="inventory" element={<ManageInventory />} />
          <Route path="attributes" element={<ManageAttributes />} />
          <Route path="reviews" element={<ManageReviews />} />
          <Route path="returns" element={<ManageReturns />} />
          <Route path="coupons" element={<ManageCoupons />} />
          <Route path="discounts" element={<Navigate to="/admin/coupons" replace />} />
          <Route path="promotions" element={<Navigate to="/admin/coupons" replace />} />
          <Route path="marketing" element={<Navigate to="/admin/coupons" replace />} />
          <Route path="website" element={<Navigate to="/admin/banners" replace />} />
          <Route path="payment-recovery" element={<PaymentRecovery />} />
          <Route path="transactions" element={<Transactions />} />
          {/* COD & Courier Settlement Routes */}
          <Route path="finance/cod-transactions" element={<CODTransactions />} />
          <Route path="cod-transactions" element={<Navigate to="/admin/finance/cod-transactions" replace />} />
          <Route path="finance/courier-settlements" element={<CourierSettlements />} />
          <Route path="courier-settlements" element={<Navigate to="/admin/finance/courier-settlements" replace />} />
          <Route path="finance/reconciliation" element={<CODReconciliation />} />
          <Route path="reconciliation" element={<Navigate to="/admin/finance/reconciliation" replace />} />
          <Route path="finance/cod-report" element={<CODSettlementReport />} />
          <Route path="cod-report" element={<Navigate to="/admin/finance/cod-report" replace />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<SystemSettings />} />
          {/* Operations & Management */}
          <Route path="shipping" element={<ManageShipping />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="staff" element={<ManageStaff />} />
          <Route path="brands" element={<ManageBrands />} />
          <Route path="navigation" element={<ManageNavigation />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
