'use client';

import { useParams } from 'next/navigation';
import { ProjectPhotos } from '@/components/projects/ProjectPhotos';

export default function JobsitePhotosPage() {
  const params = useParams<{ id: string }>();
  return <ProjectPhotos projectId={params.id} />;
}
