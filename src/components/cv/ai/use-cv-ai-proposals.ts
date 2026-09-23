import { useCallback, useState } from 'react';
import { CVData } from '@/lib/cv-types';
import { CVProposal, applyVerifiedCVProposal, verifyCVProposal } from './cv-proposals';

export function useCVAIProposals(cv: CVData, setCV: (next: CVData | ((current: CVData) => CVData)) => void) {
  const [proposals, setProposals] = useState<CVProposal[]>([]);

  const addProposals = useCallback((next: CVProposal[]) => {
    setProposals(current => [...current, ...next]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setProposals(current => current.filter(proposal => proposal.id !== id));
  }, []);

  const verifyAndApply = useCallback((id: string) => {
    setProposals(current => {
      const proposal = current.find(item => item.id === id);
      if (!proposal) return current;
      const verified = verifyCVProposal(proposal);
      setCV(data => applyVerifiedCVProposal(data, verified));
      return current.filter(item => item.id !== id);
    });
  }, [setCV]);

  const clear = useCallback(() => setProposals([]), []);

  return { proposals, addProposals, dismiss, verifyAndApply, clear, count: proposals.length };
}
