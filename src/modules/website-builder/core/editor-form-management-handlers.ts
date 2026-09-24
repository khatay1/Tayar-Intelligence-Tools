import { createDefaultContactFormFields } from './defaults';
import { normalizeFormFieldName } from './website-builder-rendering';
import type { WebsiteFormAutomation, WebsiteFormField, WebsiteFormFieldType, WebsiteSection } from './types';

type UpdateSelectedSection = (changes: Partial<Omit<WebsiteSection, 'id' | 'type'>>) => void;

interface FormManagementContext {
  selectedSection: WebsiteSection | null;
  updateSelected: UpdateSelectedSection;
  userEmail?: string | null;
}

export function createFormManagementHandlers({ selectedSection, updateSelected, userEmail }: FormManagementContext) {
  function addFormField(type: WebsiteFormFieldType = 'text') {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    const existing = selectedSection.formFields ?? createDefaultContactFormFields();
    const baseName = type === 'email' ? 'email' : type === 'tel' ? 'phone' : type === 'textarea' ? 'message' : type === 'checkbox' ? 'consent' : type === 'select' ? 'option' : 'field';
    let suffix = existing.length + 1;
    let name = baseName;
    while (existing.some((field) => field.name === name)) {
      name = `${baseName}_${suffix}`;
      suffix += 1;
    }
    const field: WebsiteFormField = {
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      label: type === 'textarea' ? 'Message' : type === 'checkbox' ? 'I agree' : type === 'select' ? 'Choose an option' : type === 'tel' ? 'Phone' : type === 'email' ? 'Email' : 'New field',
      type,
      placeholder: type === 'checkbox' ? '' : type === 'select' ? 'Choose an option' : '',
      required: false,
      options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };
    updateSelected({ formFields: [...existing, field] });
  }

  function updateFormField(fieldId: string, changes: Partial<WebsiteFormField>) {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    const existing = selectedSection.formFields ?? createDefaultContactFormFields();
    const next = existing.map((field) => {
      if (field.id !== fieldId) return field;
      const updated = { ...field, ...changes };
      if (changes.name !== undefined) updated.name = normalizeFormFieldName(changes.name, field.name || 'field');
      return updated;
    });
    updateSelected({ formFields: next });
  }

  function addFormAutomation(action: WebsiteFormAutomation['action']) {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    const automation: WebsiteFormAutomation = {
      id: `automation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: action === 'email' ? 'Email notification' : 'Webhook',
      enabled: true,
      trigger: 'submission-created',
      action,
      destination: action === 'email' ? (userEmail || '') : 'https://',
    };
    updateSelected({ formAutomations: [...(selectedSection.formAutomations || []), automation] });
  }

  function updateFormAutomation(automationId: string, changes: Partial<WebsiteFormAutomation>) {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    updateSelected({ formAutomations: (selectedSection.formAutomations || []).map((item) => item.id === automationId ? { ...item, ...changes } : item) });
  }

  function deleteFormAutomation(automationId: string) {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    updateSelected({ formAutomations: (selectedSection.formAutomations || []).filter((item) => item.id !== automationId) });
  }

  function deleteFormField(fieldId: string) {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    const existing = selectedSection.formFields ?? createDefaultContactFormFields();
    if (existing.length <= 1) return;
    updateSelected({ formFields: existing.filter((field) => field.id !== fieldId) });
  }

  function moveFormField(fieldId: string, direction: 'up' | 'down') {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    const existing = [...(selectedSection.formFields ?? createDefaultContactFormFields())];
    const index = existing.findIndex((field) => field.id === fieldId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= existing.length) return;
    [existing[index], existing[target]] = [existing[target], existing[index]];
    updateSelected({ formFields: existing });
  }

  function resetContactForm() {
    if (!selectedSection || selectedSection.type !== 'contact') return;
    updateSelected({
      formFields: createDefaultContactFormFields(),
      formSuccessMessage: 'Thanks! Your message has been sent.',
    });
  }

  return { addFormField, updateFormField, addFormAutomation, updateFormAutomation, deleteFormAutomation, deleteFormField, moveFormField, resetContactForm };
}
