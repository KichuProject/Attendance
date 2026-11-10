// API Service for connecting Expo frontend to deployed Node.js backend on Render
export const API_BASE_URL = 'https://attendance-bz3l.onrender.com/api';

export const api = {
  // Authentication
  login: async (username, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      return await res.json();
    } catch (error) {
      console.error('API login error:', error);
      return { success: false, error: 'Network error: could not connect to server' };
    }
  },

  register: async (name, username, password, role = 'employee') => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, role }),
      });
      return await res.json();
    } catch (error) {
      console.error('API register error:', error);
      return { success: false, error: 'Network error: could not connect to server' };
    }
  },

  verifyToken: async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      return await res.json();
    } catch (error) {
      console.error('API verifyToken error:', error);
      return { success: false, error: 'Network error: could not connect to server' };
    }
  },

  // Today Status & Total Days
  getTodayStatus: async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/attendance/today/${userId}`);
      return await res.json();
    } catch (error) {
      console.error('API getTodayStatus error:', error);
      return { success: false, error: 'Network error: could not connect to server' };
    }
  },

  // Punch IN with Lat & Lon
  checkIn: async (userId, inTime, latitude, longitude) => {
    try {
      const res = await fetch(`${API_BASE_URL}/attendance/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, inTime, latitude, longitude }),
      });
      return await res.json();
    } catch (error) {
      console.error('API checkIn error:', error);
      return { success: false, error: 'Network error: could not connect to server' };
    }
  },

  // Punch OUT with Out Lat & Lon
  checkOut: async (userId, outTime, outLatitude, outLongitude) => {
    try {
      const res = await fetch(`${API_BASE_URL}/attendance/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, outTime, outLatitude, outLongitude }),
      });
      return await res.json();
    } catch (error) {
      console.error('API checkOut error:', error);
      return { success: false, error: 'Network error: could not connect to server' };
    }
  },

  // Attendance History with date filtering
  getHistory: async (userId, fromDate, toDate) => {
    try {
      let url = `${API_BASE_URL}/attendance/history/${userId}`;
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      return await res.json();
    } catch (error) {
      console.error('API getHistory error:', error);
      return { success: false, records: [], error: 'Network error: could not connect to server' };
    }
  },

  // Leave Requests
  submitLeave: async (data) => {
    try {
      const res = await fetch(`${API_BASE_URL}/leave/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        return { success: false, error: `Server returned ${res.status}` };
      }
      return await res.json();
    } catch (error) {
      console.error('API submitLeave error:', error);
      return { success: false, error: 'Network error: could not connect to server' };
    }
  },

  getAllLeaveRequests: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/leave/all`);
      if (!res.ok) {
        return { success: false, requests: [], error: `Server returned ${res.status}` };
      }
      return await res.json();
    } catch (error) {
      console.error('API getAllLeaveRequests error:', error);
      return { success: false, requests: [], error: 'Network error: could not connect to server' };
    }
  },

  getUserLeaveRequests: async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/leave/user/${userId}`);
      if (!res.ok) {
        return { success: false, requests: [], error: `Server returned ${res.status}` };
      }
      return await res.json();
    } catch (error) {
      console.error('API getUserLeaveRequests error:', error);
      return { success: false, requests: [], error: 'Network error: could not connect to server' };
    }
  },

  updateLeaveStatus: async (id, status) => {
    try {
      const res = await fetch(`${API_BASE_URL}/leave/status/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        return { success: false, error: `Server returned ${res.status}` };
      }
      return await res.json();
    } catch (error) {
      console.error('API updateLeaveStatus error:', error);
      return { success: false, error: 'Network error: could not connect to server' };
    }
  },
};


