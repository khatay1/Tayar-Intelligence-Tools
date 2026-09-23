import { CVData, uid } from '@/lib/cv-types';

export type CVCollectionKey = 'experience' | 'education' | 'skills' | 'languages' | 'projects' | 'certificates' | 'awards';

export function updatePersonalField<K extends keyof CVData['personal']>(cv: CVData, field: K, value: CVData['personal'][K]): CVData {
  if (Object.is(cv.personal[field], value)) return cv;
  return { ...cv, personal: { ...cv.personal, [field]: value } };
}

export function updateCollectionItem<K extends CVCollectionKey>(
  cv: CVData,
  collection: K,
  id: string,
  patch: Partial<CVData[K][number]>,
): CVData {
  let changed = false;
  const next = cv[collection].map(item => {
    if (item.id !== id) return item;
    const keys = Object.keys(patch) as Array<keyof typeof patch>;
    if (keys.every(key => Object.is(item[key as keyof typeof item], patch[key]))) return item;
    changed = true;
    return { ...item, ...patch };
  });
  return changed ? ({ ...cv, [collection]: next } as CVData) : cv;
}

export function deleteCollectionItem<K extends CVCollectionKey>(cv: CVData, collection: K, id: string): CVData {
  if (!cv[collection].some(item => item.id === id)) return cv;
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
  if (cv[collection].some(existing => existing.id === item.id)) return cv;
  return { ...cv, [collection]: [...cv[collection], item] } as CVData;
}
