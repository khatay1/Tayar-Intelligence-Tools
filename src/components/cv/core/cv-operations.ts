import { CVData, uid } from '@/lib/cv-types';

export type CVCollectionKey = 'experience' | 'education' | 'skills' | 'languages' | 'projects' | 'certificates' | 'awards';

export function updatePersonalField<K extends keyof CVData['personal']>(cv: CVData, field: K, value: CVData['personal'][K]): CVData {
  return { ...cv, personal: { ...cv.personal, [field]: value } };
}

export function updateCollectionItem<K extends CVCollectionKey>(
  cv: CVData,
  collection: K,
  id: string,
  patch: Partial<CVData[K][number]>,
): CVData {
  return {
    ...cv,
    [collection]: cv[collection].map(item => item.id === id ? { ...item, ...patch } : item),
  } as CVData;
}

export function deleteCollectionItem<K extends CVCollectionKey>(cv: CVData, collection: K, id: string): CVData {
  return { ...cv, [collection]: cv[collection].filter(item => item.id !== id) } as CVData;
}

export const createExperience = (): CVData['experience'][number] => ({
  id: uid(), jobTitle: '', company: '', location: '', startDate: '', endDate: '', current: false, description: '',
});
export const createEducation = (): CVData['education'][number] => ({
  id: uid(), degree: '', institution: '', location: '', startDate: '', endDate: '', description: '',
});
export const createSkill = (): CVData['skills'][number] => ({ id: uid(), name: '', level: 'Intermediate' });
export const createLanguage = (): CVData['languages'][number] => ({ id: uid(), name: '', proficiency: 'Fluent' });
export const createProject = (): CVData['projects'][number] => ({ id: uid(), name: '', description: '', link: '' });
export const createCertificate = (): CVData['certificates'][number] => ({ id: uid(), name: '', issuer: '', date: '' });
export const createAward = (): CVData['awards'][number] => ({ id: uid(), title: '', issuer: '', date: '', description: '' });

export function appendCollectionItem<K extends CVCollectionKey>(cv: CVData, collection: K, item: CVData[K][number]): CVData {
  return { ...cv, [collection]: [...cv[collection], item] } as CVData;
}
