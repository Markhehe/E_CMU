import { useState, useEffect, useCallback } from 'react';

/*
 * Centralized action menu logic with Smart Viewport Collision Detection.
 * If a button is too close to the bottom of the screen, the menu flips upwards.
 */
export function useActionMenu() {
  const [openMenuId, setOpenMenuId] = useState(null);
  
  // We change this to a generic style object instead of hardcoded top/right
  const [menuCoords, setMenuCoords] = useState({});

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    
    if (openMenuId !== null) {
      window.addEventListener('click', closeMenu);
      window.addEventListener('scroll', closeMenu, true); 
      window.addEventListener('resize', closeMenu); // NEW: Closes menu on screen resize/rotation
    }
    
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [openMenuId]);

  const toggleMenu = useCallback((e, id) => {
    e.stopPropagation(); 
    
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }

    const buttonRect = e.target.getBoundingClientRect();
    const spaceBelow = window.innerHeight - buttonRect.bottom;
    
    const newCoords = {
      right: window.innerWidth - buttonRect.right,
    };

    // Smart positioning: If less than 250px below, render ABOVE the button
    if (spaceBelow < 250) {
      newCoords.bottom = window.innerHeight - buttonRect.top + 4;
    } else {
      newCoords.top = buttonRect.bottom + 4;
    }
    
    setMenuCoords(newCoords);
    setOpenMenuId(id);
  }, [openMenuId]);

  return { openMenuId, setOpenMenuId, menuCoords, toggleMenu };
}