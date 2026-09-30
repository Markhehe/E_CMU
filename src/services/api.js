import { mockRequests, documentCatalog } from '../data/mockData';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const USE_REAL_BACKEND = false; 
const API_BASE_URL = 'http://localhost:5000/api'; 

export const DocumentService = {
  // NEW: Fetch document types and prices
  getDocumentCatalog: async () => {
    if (USE_REAL_BACKEND) {
      const response = await fetch(`${API_BASE_URL}/documents/catalog`);
      if (!response.ok) throw new Error('Failed to fetch catalog');
      return response.json();
    }
    await delay(300); 
    return [...documentCatalog];
  },

  getAllRequests: async () => {
    if (USE_REAL_BACKEND) {
      const response = await fetch(`${API_BASE_URL}/requests`);
      if (!response.ok) throw new Error('Failed to fetch requests');
      return response.json();
    }
    await delay(800); 
    return [...mockRequests];
  },

  updateRequestStatus: async (requestId, newStatus) => {
    if (USE_REAL_BACKEND) {
      const response = await fetch(`${API_BASE_URL}/requests/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Failed to update status');
      return response.json();
    }
    await delay(500);
    return { success: true, id: requestId, status: newStatus };
  },

  createRequest: async (requestData) => {
    if (USE_REAL_BACKEND) {
      const response = await fetch(`${API_BASE_URL}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      if (!response.ok) throw new Error('Failed to create request');
      return response.json();
    }
    await delay(1000);
    return { 
      success: true, 
      id: `REQ-${Math.floor(Math.random() * 10000)}`, 
      dateRequested: new Date().toISOString().split('T')[0],
      status: 'PENDING PAYMENT',
      sasoCleared: false,
      hasReceipt: false,
      ...requestData 
    };
  }
};