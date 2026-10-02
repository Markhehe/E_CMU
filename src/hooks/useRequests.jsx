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
  
  // NEW: Centralized sorting state
  const [sortOption, setSortOption] = useState('DATE_DESC');

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
      const toastType = newStatus.replace(/\s+/g, '-');
      addToast(`Request ${id} marked as ${newStatus}.`, toastType);
      
    } catch (err) {
      console.error('Failed to update status on server:', err);
      setRequests(previousRequests);
      addToast(`Failed to update ${id}. Server error.`, 'error');
    }
  }, [requests, addToast]);

  const toggleClearance = useCallback(async (id, isCleared) => {
    const previousRequests = [...requests];

    setRequests((prev) => 
      prev.map(req => req.id === id ? { ...req, sasoCleared: isCleared } : req)
    );

    try {
      // API call would go here
    } catch (err) {
      console.error('Failed to update clearance:', err);
      setRequests(previousRequests); 
      addToast('Failed to update clearance. Server error.', 'error');
    }
  }, [requests, addToast]);
  
  // UPDATED: Now handles filtering AND sorting
  const processedRequests = useMemo(() => {
    // 1. First, filter the data
    const filtered = requests.filter(req => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (req.studentName?.toLowerCase()?.includes(searchLower)) || 
        (req.id?.toLowerCase()?.includes(searchLower));
      
      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // 2. Then, sort the filtered data
    return filtered.sort((a, b) => {
      
      // Define the logical lifecycle of a document (1 happens first, 5 happens last)
      const statusWeight = {
        'PENDING PAYMENT': 1,
        'PROCESSING': 2,
        'READY FOR PICKUP': 3,
        'COMPLETED': 4,
        'REJECTED': 5
      };

      switch (sortOption) {
        case 'DATE_DESC':
          return new Date(b.date) - new Date(a.date);
        case 'DATE_ASC':
          return new Date(a.date) - new Date(b.date);
        case 'ID_ASC':
          return a.id.localeCompare(b.id);
        case 'ID_DESC':
          return b.id.localeCompare(a.id);
        case 'NAME_ASC':
          return a.studentName.localeCompare(b.studentName);
        case 'NAME_DESC':
          return b.studentName.localeCompare(a.studentName);
        case 'STATUS_ASC':
          // Sorts 1 to 5 (Pending -> Completed)
          return (statusWeight[a.status] || 99) - (statusWeight[b.status] || 99);
        case 'STATUS_DESC':
          // Sorts 5 to 1 (Completed -> Pending)
          return (statusWeight[b.status] || 99) - (statusWeight[a.status] || 99);
        default:
          return 0;
      }
    });
  }, [requests, searchTerm, statusFilter, sortOption]);

  return {
    requests: processedRequests,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    sortOption,       // NEW: Exported to the dashboard
    setSortOption,    // NEW: Exported to the dashboard
    updateStatus,
    toggleClearance
  };
}