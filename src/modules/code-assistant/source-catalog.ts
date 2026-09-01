import { RegistrySource } from './types';

export const REGISTRY_SOURCES: RegistrySource[] = [
  {
    id: 'tayar-native',
    name: 'Tayar Native',
    repository: 'khatay1/Tayar-Intelligence-Tools',
    license: 'Tayar',
    redistributionAllowed: true,
    attributionRequired: false,
    note: 'Original components authored for the Tayar registry.',
  },
  {
    id: 'shadcn',
    name: 'shadcn/ui',
    repository: 'shadcn-ui/ui',
    license: 'MIT',
    redistributionAllowed: true,
    attributionRequired: true,
    note: 'MIT source. Preserve the upstream copyright and permission notice when substantial code is imported.',
  },
  {
    id: 'magic-ui',
    name: 'Magic UI',
    repository: 'magicuidesign/magicui',
    license: 'MIT',
    redistributionAllowed: true,
    attributionRequired: true,
    note: 'MIT source. Preserve the upstream copyright and permission notice when substantial code is imported.',
  },
  {
    id: 'kokonut-ui',
    name: 'KokonutUI',
    repository: 'kokonut-labs/kokonutui',
    license: 'MIT',
    redistributionAllowed: true,
    attributionRequired: true,
    note: 'MIT source. Preserve the upstream copyright and permission notice when substantial code is imported.',
  },
  {
    id: 'cult-ui',
    name: 'Cult UI',
    repository: 'nolly-studio/cult-ui',
    license: 'MIT',
    redistributionAllowed: true,
    attributionRequired: true,
    note: 'MIT source. Preserve the upstream copyright and permission notice when substantial code is imported.',
  },
  {
    id: '8bitcn',
    name: '8bitcn',
    repository: 'TheOrcDev/8bitcn-ui',
    license: 'MIT',
    redistributionAllowed: true,
    attributionRequired: true,
    note: 'MIT source. Preserve the upstream copyright and permission notice when substantial code is imported.',
  },
  {
    id: 'eldora-ui',
    name: 'Eldora UI',
    repository: 'karthikmudunuri/eldoraui',
    license: 'MIT',
    redistributionAllowed: true,
    attributionRequired: true,
    note: 'MIT source. Preserve the upstream copyright and permission notice when substantial code is imported.',
  },
  {
    id: 'ui-layouts',
    name: 'UI Layouts',
    repository: 'ui-layouts/uilayouts',
    license: 'MIT',
    redistributionAllowed: true,
    attributionRequired: true,
    note: 'MIT source. Preserve the upstream copyright and permission notice when substantial code is imported.',
  },
  {
    id: 'spectrum-ui',
    name: 'Spectrum UI',
    repository: 'arihantcodes/spectrum-ui',
    license: 'Apache-2.0',
    redistributionAllowed: true,
    attributionRequired: true,
    note: 'Apache-2.0 source. Preserve the upstream license and attribution notices when code is imported.',
  },
  {
    id: 'shadcn-space',
    name: 'Shadcn Space',
    repository: 'shadcnspace/shadcnspace',
    license: 'MIT',
    redistributionAllowed: true,
    attributionRequired: true,
    note: 'MIT source. Preserve the upstream copyright and permission notice when substantial code is imported.',
  },
  {
    id: 'animmaster-lib',
    name: 'Animmaster Lib',
    homepageUrl: 'https://animmasterlib.dev/',
    license: 'restricted',
    redistributionAllowed: false,
    attributionRequired: true,
    note: 'Paid component pack delivered privately after purchase. No public redistribution license was found, so Tayar must not bundle or mirror its code. Future support should use private user-provided licensed imports only.',
  },
  {
    id: 'react-bits',
    name: 'React Bits',
    repository: 'DavidHDev/react-bits',
    license: 'restricted',
    redistributionAllowed: false,
    attributionRequired: true,
    note: 'Current Commons Clause terms prohibit redistributing the components themselves. Keep blocked from the Tayar component registry.',
  },
];

export function getRegistrySource(sourceId: string) {
  return REGISTRY_SOURCES.find((source) => source.id === sourceId);
}

export function isRedistributableSource(sourceId: string): boolean {
  return getRegistrySource(sourceId)?.redistributionAllowed === true;
}
