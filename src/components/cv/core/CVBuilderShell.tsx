import React from 'react';
import { ColorTheme, SectionConfig, TemplateId, ResumeVersion, CVData } from '@/lib/cv-types';
import { CVContentEditor } from '../editor/CVContentEditor';
import { CVDesignPanel } from '../design/CVDesignPanel';
import { CVJobMatchPanel } from '../job/CVJobMatchPanel';
import { CVAIProposalPanel } from '../ai/CVAIProposalPanel';
import { CVVersionsPanel } from '../versions/CVVersionsPanel';
import { CVATSReport } from '../quality/cv-ats';
import { CVProposal } from '../ai/cv-proposals';
import { CVCollectionKey } from './cv-operations';

export type CVBuilderPanel = 'edit' | 'design' | 'ai' | 'job' | 'versions';

interface Props {
  panel: CVBuilderPanel;
  editSection: string;
  cv: CVData;
  template: TemplateId;
  colorTheme: ColorTheme;
  fontId: string;
  sections: SectionConfig[];
  editor: {
    updatePersonal: <K extends keyof CVData['personal']>(field: K, value: CVData['personal'][K]) => void;
    updateItem: <K extends CVCollectionKey>(collection: K, id: string, patch: Partial<CVData[K][number]>) => void;
    deleteItem: <K extends CVCollectionKey>(collection: K, id: string) => void;
    addExperience: () => void; addEducation: () => void; addSkill: () => void; addLanguage: () => void;
    addProject: () => void; addCertificate: () => void; addAward: () => void;
  };
  setCV: (next: CVData | ((current: CVData) => CVData)) => void;
  setTemplate: (value: TemplateId) => void;
  setColorTheme: (value: ColorTheme) => void;
  setFontId: (value: string) => void;
  sectionsController: { draggedIndex: number | null; dragStart: (index: number) => void; dragEnd: () => void; drop: (index: number) => void; toggle: (id: SectionConfig['id']) => void };
  jobDescription: string;
  setJobDescription: (value: string) => void;
  ats: CVATSReport;
  proposals: CVProposal[];
  onVerifyProposal: (id: string) => void;
  onDismissProposal: (id: string) => void;
  versions: ResumeVersion[];
  versionsLoading?: boolean;
  onSaveVersion: () => void | Promise<unknown>;
  onRestoreVersion: (version: ResumeVersion) => void | Promise<unknown>;
}

export function CVBuilderShell(props: Props) {
  if (props.panel === 'edit') return <CVContentEditor cv={props.cv} section={props.editSection} setCV={props.setCV} editor={props.editor} />;
  if (props.panel === 'design') return <CVDesignPanel template={props.template} colorTheme={props.colorTheme} fontId={props.fontId} sections={props.sections} setTemplate={props.setTemplate} setColorTheme={props.setColorTheme} setFontId={props.setFontId} {...props.sectionsController} />;
  if (props.panel === 'job') return <CVJobMatchPanel jobDescription={props.jobDescription} setJobDescription={props.setJobDescription} report={props.ats} />;
  if (props.panel === 'versions') return <CVVersionsPanel versions={props.versions} loading={props.versionsLoading} onSave={props.onSaveVersion} onRestore={props.onRestoreVersion} />;
  return <CVAIProposalPanel proposals={props.proposals} onVerifyApply={props.onVerifyProposal} onDismiss={props.onDismissProposal} />;
}
