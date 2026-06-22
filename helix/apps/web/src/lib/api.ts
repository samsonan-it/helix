import axios from 'axios';

const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) {
  throw new Error(
    '[helix] VITE_API_URL is not set. Add it to .env.development. Never hardcode or default this value.',
  );
}

export const api = axios.create({ baseURL: apiUrl, withCredentials: true });

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      if (window.location.pathname === '/login') {
        return Promise.reject(err);
      }
      if (import.meta.env.VITE_AZURE_AD_CLIENT_ID) {
        // Preserve destination so it can be restored after the OAuth callback.
        try {
          sessionStorage.setItem('helix_post_auth_redirect', window.location.pathname + window.location.search);
        } catch {
          // SecurityError in private browsing — redirect proceeds without saved destination.
        }
        // Use absolute backend URL — relative '/auth/azure' would hit the SPA, not the API.
        window.location.href = `${apiUrl}/auth/azure`;
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);
