import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set a timer to update the value only AFTER the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // If the value changes again before the delay finishes, clear the timer and restart
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}