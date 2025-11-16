// src/components/NavigationListener.tsx

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';

const NavigationListener = () => {
  const location = useLocation();
  const { isLayoutEditMode, toggleLayoutEditMode } = useData();

  useEffect(() => {
    if (isLayoutEditMode) {
      toggleLayoutEditMode();
    }
  }, [location.pathname]);

  return null;
};

export default NavigationListener;