import { useCallback, useEffect, useState } from 'react';
import { ClearanceService } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export function useStudentClearance({ enabled = true } = {}) {
  const [clearance, setClearance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToast();

  const refreshClearance = useCallback(async () => {
    setIsLoading(true);
    try {
      setClearance(await ClearanceService.getMine());
    } catch (error) {
      addToast(error.message || 'Failed to load clearance status.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (!enabled) return undefined;
    refreshClearance();
    return undefined;
  }, [enabled, refreshClearance]);

  const submitClearance = useCallback(async (file) => {
    setIsUploading(true);
    try {
      const result = await ClearanceService.submit(file);
      setClearance(result.clearance);
      addToast('Clearance uploaded for Registrar verification.', 'success');
      return result.clearance;
    } catch (error) {
      addToast(error.message || 'Failed to upload clearance.', 'error');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [addToast]);

  const deletePendingClearance = useCallback(async () => {
    if (!clearance || clearance.status !== 'submitted') return false;
    setIsDeleting(true);
    try {
      await ClearanceService.deletePending(clearance.id);
      setClearance(null);
      addToast('Clearance submission deleted.', 'success');
      return true;
    } catch (error) {
      addToast(error.message || 'Failed to delete clearance submission.', 'error');
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [addToast, clearance]);

  return {
    clearance,
    isLoading,
    isUploading,
    isDeleting,
    isVerified: clearance?.status === 'verified',
    refreshClearance,
    submitClearance,
    deletePendingClearance,
  };
}
