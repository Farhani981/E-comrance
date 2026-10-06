import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

const AdminAlertContext = createContext(null);

export const useAdminAlert = () => {
  const context = useContext(AdminAlertContext);
  if (!context) {
    // Fallback if used outside provider
    return {
      showAlert: (msg, type = 'info', title = '') => {
        alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
      },
    };
  }
  return context;
};

export function AdminAlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const showAlert = useCallback((options, defaultType = 'info', defaultTitle = '') => {
    let alertItem;
    if (typeof options === 'string') {
      alertItem = {
        id: Date.now() + Math.random(),
        message: options,
        type: defaultType,
        title: defaultTitle || (defaultType === 'error' ? 'Error' : defaultType === 'warning' ? 'Warning' : defaultType === 'success' ? 'Success' : 'Notice'),
        duration: 4500,
      };
    } else {
      const type = options.type || 'info';
      alertItem = {
        id: Date.now() + Math.random(),
        message: options.message || '',
        type,
        title: options.title || (type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : type === 'success' ? 'Success' : 'Notice'),
        duration: options.duration || 4500,
      };
    }

    setAlerts((prev) => [...prev, alertItem]);

    if (alertItem.duration > 0) {
      setTimeout(() => {
        removeAlert(alertItem.id);
      }, alertItem.duration);
    }
  }, [removeAlert]);

  // Provide global fallback so any code can invoke window.adminAlert
  useEffect(() => {
    window.adminAlert = (msg, type = 'info', title = '') => showAlert(msg, type, title);
    return () => {
      delete window.adminAlert;
    };
  }, [showAlert]);

  const getAlertStyles = (type) => {
    switch (type) {
      case 'error':
        return {
          cardBg: 'bg-white',
          border: 'border-rose-200 ring-1 ring-rose-500/10',
          iconBg: 'bg-rose-50 text-rose-600',
          badgeBg: 'bg-rose-100 text-rose-700',
          progressBar: 'bg-rose-500',
          titleColor: 'text-rose-900',
          icon: <FiAlertCircle className="w-5 h-5" />,
        };
      case 'warning':
        return {
          cardBg: 'bg-white',
          border: 'border-amber-200 ring-1 ring-amber-500/10',
          iconBg: 'bg-amber-50 text-amber-600',
          badgeBg: 'bg-amber-100 text-amber-800',
          progressBar: 'bg-amber-500',
          titleColor: 'text-amber-900',
          icon: <FiAlertTriangle className="w-5 h-5" />,
        };
      case 'success':
        return {
          cardBg: 'bg-white',
          border: 'border-emerald-200 ring-1 ring-emerald-500/10',
          iconBg: 'bg-emerald-50 text-emerald-600',
          badgeBg: 'bg-emerald-100 text-emerald-800',
          progressBar: 'bg-emerald-500',
          titleColor: 'text-emerald-900',
          icon: <FiCheckCircle className="w-5 h-5" />,
        };
      default:
        return {
          cardBg: 'bg-white',
          border: 'border-blue-200 ring-1 ring-blue-500/10',
          iconBg: 'bg-blue-50 text-blue-600',
          badgeBg: 'bg-blue-100 text-blue-800',
          progressBar: 'bg-blue-500',
          titleColor: 'text-slate-900',
          icon: <FiInfo className="w-5 h-5" />,
        };
    }
  };

  return (
    <AdminAlertContext.Provider value={{ showAlert, removeAlert }}>
      {children}

      {/* Floating Alert Cards Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm sm:max-w-md w-full pointer-events-none px-4 sm:px-0">
        {alerts.map((alert) => {
          const styles = getAlertStyles(alert.type);
          return (
            <div
              key={alert.id}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border ${styles.border} ${styles.cardBg} shadow-xl p-4 sm:p-4 transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-top-4`}
              role="alert"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${styles.iconBg} shrink-0 mt-0.5`}>
                  {styles.icon}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${styles.badgeBg}`}>
                      {alert.type}
                    </span>
                    <h4 className={`text-sm font-bold ${styles.titleColor} truncate`}>
                      {alert.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed break-words">
                    {alert.message}
                  </p>
                </div>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition shrink-0"
                  aria-label="Close Alert"
                >
                  <FiX size={16} />
                </button>
              </div>

              {/* Subtle Animated Progress Line */}
              {alert.duration > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                  <div
                    className={`h-full ${styles.progressBar} transition-all`}
                    style={{
                      animation: `alert-shrink ${alert.duration}ms linear forwards`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AdminAlertContext.Provider>
  );
}