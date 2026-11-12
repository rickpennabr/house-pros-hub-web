'use client';

import { useEffect, useState } from 'react';

/** Phones and tablets: no hover, coarse pointer. */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    const apply = () => setPhone(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return phone;
}
