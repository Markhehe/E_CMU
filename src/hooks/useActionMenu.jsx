import { useState, useEffect, useCallback } from 'react';

/**
 * CAPSTONE DEFENSE NOTE (DRY Principle): 
 * Instead of rewriting the window click/scroll event listeners in every dashboard,
 * this hook centralizes the logic. If we ever need to fix a bug with the dropdowns, 
 * we only have to fix it in this one file.
 */
export function useActionMenu() {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuCoords, setMenuCoords] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    
    if (openMenuId !== null) {
      window.addEventListener('click', closeMenu);
      // 'true' ensures it closes even if a deeply nested table scrolls
      window.addEventListener('scroll', closeMenu, true); 
    }
    
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [openMenuId]);

  const toggleMenu = useCallback((e, id) => {
    e.stopPropagation(); // Prevents the window click listener from immediately closing it
    
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }

    // Calculates exactly where the button is on the screen to place the menu
    const buttonRect = e.target.getBoundingClientRect();
    setMenuCoords({
      top: buttonRect.bottom + 4,
      right: window.innerWidth - buttonRect.right,
    });
    
    setOpenMenuId(id);
  }, [openMenuId]);

  return { openMenuId, setOpenMenuId, menuCoords, toggleMenu };
}