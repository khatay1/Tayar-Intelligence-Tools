export type DeliveryStatus = 'building' | 'review' | 'approved' | 'delivered';

export interface WebsiteDeliveryConfig {
  clientName: string;
  clientEmail: string;
  projectCode: string;
  status: DeliveryStatus;
  dueDate: string;
  handoffNotes: string;
  whiteLabel: boolean;
  approvedAt: string | null;
  approvedFingerprint: string;
  deliveredAt: string | null;
}

export const DEFAULT_DELIVERY_CONFIG: WebsiteDeliveryConfig = {
  clientName: '',
  clientEmail: '',
  projectCode: '',
  status: 'building',
  dueDate: '',
  handoffNotes: '',
  whiteLabel: true,
  approvedAt: null,
  approvedFingerprint: '',
  deliveredAt: null,
};

export function normalizeDeliveryConfig(
  value: Partial<WebsiteDeliveryConfig> | null | undefined,
): WebsiteDeliveryConfig {
  const status: DeliveryStatus =
    value?.status === 'review' ||
    value?.status === 'approved' ||
    value?.status === 'delivered'
      ? value.status
      : 'building';

  return {
    clientName:
      typeof value?.clientName === 'string'
        ? value.clientName.slice(0, 160)
        : '',
    clientEmail:
      typeof value?.clientEmail === 'string'
        ? value.clientEmail.slice(0, 200)
        : '',
    projectCode:
      typeof value?.projectCode === 'string'
        ? value.projectCode.slice(0, 80)
        : '',
    status,
    dueDate:
      typeof value?.dueDate === 'string'
        ? value.dueDate.slice(0, 20)
        : '',
    handoffNotes:
      typeof value?.handoffNotes === 'string'
        ? value.handoffNotes.slice(0, 4000)
        : '',
    whiteLabel: value?.whiteLabel !== false,
    approvedAt:
      typeof value?.approvedAt === 'string' ? value.approvedAt : null,
    approvedFingerprint:
      typeof value?.approvedFingerprint === 'string'
        ? value.approvedFingerprint.slice(0, 200000)
        : '',
    deliveredAt:
      typeof value?.deliveredAt === 'string' ? value.deliveredAt : null,
  };
}
