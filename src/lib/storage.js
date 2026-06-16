const STORAGE_KEY = "datareports-config";

export function loadPortalState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const data = JSON.parse(stored);
    return {
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      recentViews: Array.isArray(data.recentViews) ? data.recentViews : [],
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      requests: Array.isArray(data.requests) ? data.requests : [],
      auditEvents: Array.isArray(data.auditEvents) ? data.auditEvents : [],
    };
  } catch (error) {
    return {};
  }
}

export function savePortalState({ favorites, recentViews, notifications, requests, auditEvents }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        favorites: favorites || [],
        recentViews: recentViews || [],
        notifications: notifications || [],
        requests: requests || [],
        auditEvents: auditEvents || [],
      })
    );
  } catch (error) {
    // Local persistence is best-effort; Netlify Blobs remains the source for shared data.
  }
}
