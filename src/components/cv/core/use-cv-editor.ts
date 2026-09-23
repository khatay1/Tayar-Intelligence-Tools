import { useCallback, useMemo } from 'react';
import { CVData } from '@/lib/cv-types';
import {
  appendCollectionItem,
  createAward,
  createCertificate,
  createEducation,
  createExperience,
  createLanguage,
  createProject,
  createSkill,
  CVCollectionKey,
  deleteCollectionItem,
  updateCollectionItem,
  updatePersonalField,
} from './cv-operations';

export function useCVEditor(cv: CVData, setCV: (next: CVData | ((current: CVData) => CVData)) => void) {
  const updatePersonal = useCallback(<K extends keyof CVData['personal']>(field: K, value: CVData['personal'][K]) => {
    setCV(current => updatePersonalField(current, field, value));
  }, [setCV]);

  const updateItem = useCallback(<K extends CVCollectionKey>(collection: K, id: string, patch: Partial<CVData[K][number]>) => {
    setCV(current => updateCollectionItem(current, collection, id, patch));
  }, [setCV]);

  const deleteItem = useCallback(<K extends CVCollectionKey>(collection: K, id: string) => {
    setCV(current => deleteCollectionItem(current, collection, id));
  }, [setCV]);

  const appendItem = useCallback(<K extends CVCollectionKey>(collection: K, item: CVData[K][number]) => {
    setCV(current => appendCollectionItem(current, collection, item));
  }, [setCV]);

  const addExperience = useCallback(() => appendItem('experience', createExperience()), [appendItem]);
  const addEducation = useCallback(() => appendItem('education', createEducation()), [appendItem]);
  const addSkill = useCallback(() => appendItem('skills', createSkill()), [appendItem]);
  const addLanguage = useCallback(() => appendItem('languages', createLanguage()), [appendItem]);
  const addProject = useCallback(() => appendItem('projects', createProject()), [appendItem]);
  const addCertificate = useCallback(() => appendItem('certificates', createCertificate()), [appendItem]);
  const addAward = useCallback(() => appendItem('awards', createAward()), [appendItem]);

  return useMemo(() => ({
    cv,
    updatePersonal,
    updateItem,
    deleteItem,
    addExperience,
    addEducation,
    addSkill,
    addLanguage,
    addProject,
    addCertificate,
    addAward,
  }), [cv, updatePersonal, updateItem, deleteItem, addExperience, addEducation, addSkill, addLanguage, addProject, addCertificate, addAward]);
}
