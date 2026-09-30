import { useState, useEffect, useMemo, useCallback } from 'react';
import { DocumentService } from '../services/api';
import { useToast } from '../contexts/ToastContext'; 

const fallbackStudents = [
  { studentName: 'Yuan Atanacio', studentId: '2023-0145' },
  { studentName: 'Maria Santos', studentId: '2022-0891' },
  { studentName: 'Juan Dela Cruz', studentId: '2021-0332' },
  { studentName: 'Anna Reyes', studentId: '2024-0112' },
  { studentName: 'Mark Bautista', studentId: '2020-0554' }
];

export function useRequests() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { addToast } = useToast(); 

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    let isMounted = true;

    const fetchRequests = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await DocumentService.getAllRequests();
        
        if (isMounted) {
          const formattedData = data.map((req, index) => ({
            ...req,
            studentName: req.studentName || fallbackStudents[index % fallbackStudents.length].studentName,
            studentId: req.studentId || fallbackStudents[index % fallbackStudents.length].studentId,
            date: req.dateRequested || req.date
          }));
          
          setRequests(formattedData);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        if (isMounted) setError('Failed to load requests.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchRequests();
    return () => { isMounted = false; };
  }, []);

 const updateStatus = useCallback(async (id, newStatus) => {
    const previousRequests = [...requests];

    setRequests((prev) => 
      prev.map(req => req.id === id ? { ...req, status: newStatus } : req)
    );

    try {
      await DocumentService.updateRequestStatus(id, newStatus);
      
      // 🔥 NEW: Convert spaces to dashes for the CSS class (e.g., "PENDING PAYMENT" -> "PENDING-PAYMENT")
      const toastType = newStatus.replace(/\s+/g, '-');
      
      addToast(`Request ${id} marked as ${newStatus}.`, toastType);
      
    } catch (err) {
      console.error('Failed to update status on server:', err);
      setRequests(previousRequests);
      addToast(`Failed to update ${id}. Server error.`, 'error');
    }
  }, [requests, addToast]);

  // NEW FUNCTION: For the SASO Dashboard
  const toggleClearance = useCallback(async (id, isCleared) => {
    const previousRequests = [...requests];

    // Optimistic UI update
    setRequests((prev) => 
      prev.map(req => req.id === id ? { ...req, sasoCleared: isCleared } : req)
    );

    try {
      // In a real app, this would hit a specific API endpoint:
      // await fetch(`/api/requests/${id}/clearance`, { method: 'PATCH', body: JSON.stringify({ isCleared }) });
      
      // For the mockup, we just let the optimistic update stand.
    } catch (err) {
      console.error('Failed to update clearance:', err);
      setRequests(previousRequests); // Rollback
      addToast('Failed to update clearance. Server error.', 'error');
    }
  }, [requests, addToast]);
  
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = 
        (req.studentName?.toLowerCase()?.includes(searchLower)) || 
        (req.id?.toLowerCase()?.includes(searchLower));
      
      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  return {
    requests: filteredRequests,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    updateStatus,
    toggleClearance
  };
}