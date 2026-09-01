const STORAGE_KEY = "datareports-config";
const CATALOG_RECOVERY_KEY = "datareports-admin-catalog-recovery";

export function loadPortalState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const data = JSON.parse(stored);
    return {
      reports: Array.isArray(data.reports) ? data.reports : [],
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      recentViews: Array.isArray(data.recentViews) ? data.recentViews : [],
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      requests: Array.isArray(data.requests) ? data.requests : [],
      auditEvents: Array.isArray(data.auditEvents) ? data.auditEvents : [],
      incidents: Array.isArray(data.incidents) ? data.incidents : [],
    };
  } catch (error) {
    return {};
  }
}

export function savePortalState({ reports, favorites, recentViews, notifications, requests, auditEvents, incidents }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        favorites: favorites || [],
        recentViews: recentViews || [],
        notifications: notifications || [],
        requests: requests || [],
        auditEvents: auditEvents || [],
        incidents: incidents || [],
      })
    );
  } catch (error) {
    // Local persistence is best-effort; Netlify Blobs remains the source for shared data.
  }
}

export function loadCatalogRecovery() {
  try {
    const storedRecovery = JSON.parse(localStorage.getItem(CATALOG_RECOVERY_KEY) || "null");
    if (Array.isArray(storedRecovery)) return storedRecovery;

    const legacyState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const legacyReports = Array.isArray(legacyState?.reports) ? legacyState.reports : [];
    if (legacyReports.length) {
      localStorage.setItem(CATALOG_RECOVERY_KEY, JSON.stringify(legacyReports));
    }
    return legacyReports;
  } catch (error) {
    return [];
  }
}

export function saveCatalogRecovery(reports) {
  try {
    localStorage.setItem(CATALOG_RECOVERY_KEY, JSON.stringify(Array.isArray(reports) ? reports : []));
  } catch (error) {
    // Recovery persistence is best-effort and is never used for user authorization.
  }
}
