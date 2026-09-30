/**
 * Formats a raw database date string (YYYY-MM-DD) into a human-readable format.
 * Example: "2026-10-24" -> "Oct 24, 2026"
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(dateString));
  } catch (error) {
    console.error("Invalid date format provided:", dateString);
    return dateString;
  }
};