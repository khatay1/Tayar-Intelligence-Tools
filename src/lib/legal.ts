function publicEnv(name: string): string {
  return ((import.meta.env as Record<string, string | undefined>)[name] || '').trim();
}

export const legalIdentity = {
  name: publicEnv('VITE_LEGAL_ENTITY_NAME'),
  registrationNumber: publicEnv('VITE_LEGAL_REGISTRATION_NUMBER'),
  postalAddress: publicEnv('VITE_LEGAL_POSTAL_ADDRESS'),
  country: publicEnv('VITE_LEGAL_COUNTRY'),
  contactEmail: publicEnv('VITE_LEGAL_CONTACT_EMAIL'),
};

export const LEGAL_LAST_UPDATED = 'September 6, 2026';
