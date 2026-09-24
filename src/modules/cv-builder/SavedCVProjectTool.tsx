import ResumeBuilder from '@/components/cv/ResumeBuilder';

interface SavedCVProjectToolProps {
  projectId?: string | null;
}

export default function SavedCVProjectTool({ projectId = null }: SavedCVProjectToolProps) {
  return (
    <ResumeBuilder
      projectId={projectId}
      onBack={() => { window.location.hash = '#workspace/my-files'; }}
    />
  );
}
