const BASE = '/api';

function getToken() {
  return localStorage.getItem('impersonateToken') || localStorage.getItem('token');
}

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
});

export const get = (path) => fetch(BASE + path, { headers: headers() }).then(r => r.json());
export const post = (path, body) => fetch(BASE + path, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json());
export const put = (path, body) => fetch(BASE + path, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(r => r.json());
export const del = (path) => fetch(BASE + path, { method: 'DELETE', headers: headers() }).then(r => r.json());
