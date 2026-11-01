import { useCallback, useEffect, useState } from 'react';
import { ClearanceService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useServerEvents } from './useServerEvents';

export function useStudentClearance({ enabled = true } = {}) {
  const [clearance, setClearance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToast();

  const refreshClearance = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      setClearance(await ClearanceService.getMine());
    } catch (error) {
      addToast(error.message || 'Failed to load clearance status.', 'error');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [addToast]);

  const refreshClearanceFromServer = useCallback(
    () => refreshClearance(false),
    [refreshClearance],
  );
  useServerEvents('clearances', refreshClearanceFromServer, enabled);

  useEffect(() => {
    if (!enabled) return undefined;
    const timeoutId = window.setTimeout(refreshClearance, 0);
    return () => window.clearTimeout(timeoutId);
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
