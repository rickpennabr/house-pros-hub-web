'use client';

import { useParams } from 'next/navigation';
import AppointmentManager from '@/components/booking/AppointmentManager';

export default function ManageAppointmentPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';
  return <AppointmentManager token={token} />;
}
