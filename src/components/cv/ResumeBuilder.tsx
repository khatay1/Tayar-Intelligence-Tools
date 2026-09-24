import { lazy, Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface ResumeBuilderProps {
  onBack: () => void;
  projectId?: string | null;
  cvId?: string | null;
}

const ResumeBuilderImpl = lazy(() => import('./ResumeBuilder.impl'));

export default function ResumeBuilder(props: ResumeBuilderProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResumeBuilderImpl {...props} />
    </Suspense>
  );
}
