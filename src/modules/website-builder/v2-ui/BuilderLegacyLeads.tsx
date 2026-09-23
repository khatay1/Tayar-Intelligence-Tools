import type * as React from 'react';
import type { LeadStage,WebsiteLead } from '../core/website-builder-model';
import { getWebsiteLeadPhone,getWebsiteLeadSource } from '../core/website-lead-utils';
import type { WebsiteFormDelivery } from '../services/websiteFormService';

interface BuilderLegacyLeadsProps {
  archiveReadLeads: () => Promise<void>;
  bulkUpdateLeadStage: (stage: LeadStage) => Promise<void>;
  copyLeadSummary: (lead: WebsiteLead) => Promise<void>;
  darkMode: boolean;
  deleteLead: (leadId: string) => Promise<void>;
  exportLeadsCsv: () => void;
  filteredLeads: WebsiteLead[];
  formDeliveries: WebsiteFormDelivery[];
  l: (text: string) => string;
  leadCrmSummary: { total: number; newCount: number; qualified: number; contacted: number; won: number; lost: number; winRate: number; highPriority: number; };
  leadQuery: string;
  leads: WebsiteLead[];
  leadsError: string;
  leadsLoading: boolean;
  leadStageFilter: LeadStage | "all";
  leadStatusFilter: "new" | "read" | "archived" | "all";
  markAllLeadsRead: () => Promise<void>;
  openWebsiteFormUpload: (path: string) => Promise<void>;
  refreshLeads: () => Promise<void>;
  selectedLeadIds: string[];
  setLeadQuery: React.Dispatch<React.SetStateAction<string>>;
  setLeadsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLeadStageFilter: React.Dispatch<React.SetStateAction<LeadStage | "all">>;
  setLeadStatusFilter: React.Dispatch<React.SetStateAction<"new" | "read" | "archived" | "all">>;
  setSelectedLeadIds: React.Dispatch<React.SetStateAction<string[]>>;
  updateLeadCrm: (leadId: string, updates: Partial<Pick<WebsiteLead, "stage" | "priority" | "tags" | "notes">>) => Promise<void>;
  updateLeadStatus: (leadId: string, status: WebsiteLead["status"]) => Promise<void>;
}

export function BuilderLegacyLeads({
  archiveReadLeads,
  bulkUpdateLeadStage,
  copyLeadSummary,
  darkMode,
  deleteLead,
  exportLeadsCsv,
  filteredLeads,
  formDeliveries,
  l,
  leadCrmSummary,
  leadQuery,
  leads,
  leadsError,
  leadsLoading,
  leadStageFilter,
  leadStatusFilter,
  markAllLeadsRead,
  openWebsiteFormUpload,
  refreshLeads,
  selectedLeadIds,
  setLeadQuery,
  setLeadsOpen,
  setLeadStageFilter,
  setLeadStatusFilter,
  setSelectedLeadIds,
  updateLeadCrm,
  updateLeadStatus,
}: BuilderLegacyLeadsProps) {
  return (
<div className={`border-b px-4 py-3 ${darkMode ? 'border-cyan-500/20 bg-[#08131a]' : 'border-cyan-200 bg-cyan-50/50'}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Lead CRM')}</p>
                <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l('Search, qualify, prioritize and follow up with website leads.')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={exportLeadsCsv} disabled={!leads.length} className="text-xs font-semibold text-sky-400 disabled:opacity-40">CSV</button>
                <button onClick={() => void markAllLeadsRead()} disabled={!leads.some((lead) => lead.status === 'new')} className="text-xs font-semibold text-emerald-400 disabled:opacity-40">{l('Read all')}</button>
                <button onClick={() => void archiveReadLeads()} disabled={!leads.some((lead) => lead.status === 'read')} className="text-xs font-semibold text-gray-400 disabled:opacity-40">{l('Archive read')}</button>
                <button onClick={() => void refreshLeads()} disabled={leadsLoading} className="text-xs font-semibold text-cyan-400 disabled:opacity-50">{leadsLoading ? 'Refreshing…' : 'Refresh'}</button>
                <button onClick={() => setLeadsOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {[
                ['Total', leadCrmSummary.total],
                ['New', leadCrmSummary.newCount],
                ['Qualified', leadCrmSummary.qualified],
                ['Contacted', leadCrmSummary.contacted],
                ['Won', leadCrmSummary.won],
                ['Lost', leadCrmSummary.lost],
                ['High priority', leadCrmSummary.highPriority],
                ['Win rate', `${leadCrmSummary.winRate}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className={`rounded-xl border p-2 ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-100 bg-white'}`}>
                  <p className="text-[9px] uppercase tracking-wide text-gray-500">{label}</p>
                  <p className="mt-1 text-sm font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <input value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder={l('Search name, email, message, tags…')} className={`min-w-56 flex-1 rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
              <select value={leadStatusFilter} onChange={(e) => setLeadStatusFilter(e.target.value as 'all' | WebsiteLead['status'])} className={`rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                <option value="all">{l('All inbox statuses')}</option><option value="new">{l('New')}</option><option value="read">{l('Read')}</option><option value="archived">{l('Archived')}</option>
              </select>
              <select value={leadStageFilter} onChange={(e) => setLeadStageFilter(e.target.value as 'all' | LeadStage)} className={`rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                <option value="all">{l('All CRM stages')}</option><option value="new">{l('New')}</option><option value="qualified">{l('Qualified')}</option><option value="contacted">{l('Contacted')}</option><option value="won">{l('Won')}</option><option value="lost">{l('Lost')}</option>
              </select>
              <button type="button" onClick={() => setSelectedLeadIds(filteredLeads.map((lead) => lead.id))} disabled={!filteredLeads.length} className="rounded-lg border border-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-400 disabled:opacity-40">{l('Select shown')}</button>
              {!!selectedLeadIds.length && <button type="button" onClick={() => setSelectedLeadIds([])} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400">Clear ({selectedLeadIds.length})</button>}
            </div>

            {!!selectedLeadIds.length && (
              <div className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 ${darkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>
                <span className="text-[10px] font-bold text-violet-400">{l('Bulk stage:')}</span>
                {(['qualified', 'contacted', 'won', 'lost'] as LeadStage[]).map((stage) => <button key={stage} type="button" onClick={() => void bulkUpdateLeadStage(stage)} className="rounded border border-violet-500/20 px-2 py-1 text-[10px] font-semibold capitalize text-violet-400">{l(stage)}</button>)}
              </div>
            )}

            {leadsError && <p className="text-xs text-amber-400">{l(leadsError)}</p>}

            {!leadsLoading && !leads.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>{l('No leads yet. Publish a website with a Contact section, then submissions will appear here.')}</div>
            ) : !leadsLoading && !filteredLeads.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>{l('No leads match the current search and filters.')}</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filteredLeads.map((lead) => {
                  const meta = getWebsiteLeadSource(lead);
                  const phone = getWebsiteLeadPhone(lead);
                  const stage = lead.stage || 'new';
                  const visibleFormData = Object.entries(lead.form_data || {}).filter(([key]) => !key.startsWith('_'));
                  const deliveryAttempts = formDeliveries.filter((delivery) => delivery.lead_id === lead.id);
                  return (
                  <article key={lead.id} className={`rounded-xl border p-3 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={(e) => setSelectedLeadIds((current) => e.target.checked ? [...new Set([...current, lead.id])] : current.filter((id) => id !== lead.id))} />
                        <div className="min-w-0">
                          <p className="truncate font-bold">{lead.name}</p>
                          {lead.email && <a href={`mailto:${lead.email}`} className="block truncate text-cyan-400">{lead.email}</a>}
                          {phone && <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="block truncate text-emerald-400">{phone}</a>}
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${lead.status === 'new' ? 'bg-cyan-500/15 text-cyan-400' : lead.status === 'archived' ? 'bg-gray-500/15 text-gray-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{l(lead.status)}</span>
                    </div>

                    <div className="mb-2 grid grid-cols-2 gap-2">
                      <select value={stage} onChange={(e) => void updateLeadCrm(lead.id, { stage: e.target.value as LeadStage })} className={`rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                        <option value="new">{l('New')}</option><option value="qualified">{l('Qualified')}</option><option value="contacted">{l('Contacted')}</option><option value="won">{l('Won')}</option><option value="lost">{l('Lost')}</option>
                      </select>
                      <select value={Number(lead.priority || 0)} onChange={(e) => void updateLeadCrm(lead.id, { priority: Number(e.target.value) })} className={`rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                        <option value={0}>{l('Normal priority')}</option><option value={1}>{l('★ Priority')}</option><option value={2}>{l('★★ High priority')}</option>
                      </select>
                    </div>

                    {(meta.source || meta.campaign || meta.referrer) && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {meta.source && <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-[9px] text-fuchsia-400">Source: {meta.source}{meta.medium ? ` / ${meta.medium}` : ''}</span>}
                        {meta.campaign && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] text-violet-400">Campaign: {meta.campaign}</span>}
                        {!meta.source && meta.referrer && <span className="max-w-full truncate rounded-full bg-sky-500/10 px-2 py-0.5 text-[9px] text-sky-400">Referrer: {meta.referrer}</span>}
                      </div>
                    )}

                    {!!lead.tags?.length && <div className="mb-2 flex flex-wrap gap-1">{lead.tags.map((tag) => <span key={tag} className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-400">#{tag}</span>)}</div>}
                    {(lead.form_name || lead.workflow_status || lead.files?.length) && <div className="mb-2 flex flex-wrap gap-1">{lead.form_name && <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[9px] text-cyan-400">{lead.form_name}</span>}{lead.workflow_status && <span className={`rounded-full px-2 py-0.5 text-[9px] ${lead.workflow_status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : lead.workflow_status === 'failed' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>{l('Workflow')}: {lead.workflow_status}</span>}{Boolean(lead.files?.length) && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] text-violet-400">{l('Uploaded files')}: {lead.files!.length}</span>}</div>}
                    {!!lead.files?.length && <div className="mb-2 flex flex-wrap gap-1">{lead.files.map((file) => <button key={file.path} type="button" onClick={() => void openWebsiteFormUpload(file.path)} className="max-w-full truncate rounded border border-violet-500/20 px-2 py-1 text-[9px] font-semibold text-violet-400" title={`${file.name} · ${Math.ceil(file.size / 1024)} KB`}>{l('Open file')}: {file.name}</button>)}</div>}
                    {!!deliveryAttempts.length && (
                      <div className={`mb-2 rounded-lg border p-2 ${darkMode ? 'border-sky-500/20 bg-sky-500/5' : 'border-sky-100 bg-sky-50'}`}>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-sky-400">{l('Automation delivery log')}</p>
                        <div className="grid gap-1">
                          {deliveryAttempts.map((delivery) => (
                            <div key={delivery.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px]">
                              <span className="font-semibold uppercase text-gray-500">{delivery.action_type}</span>
                              <span className="max-w-40 truncate text-gray-500" title={delivery.destination_hint}>{delivery.destination_hint}</span>
                              <span className={delivery.status === 'delivered' ? 'text-emerald-400' : delivery.status === 'failed' ? 'text-rose-400' : 'text-amber-400'}>{l(delivery.status === 'delivered' ? 'Delivered' : delivery.status === 'failed' ? 'Failed' : delivery.status === 'processing' ? 'Processing' : 'Pending')}</span>
                              <span className="text-gray-500">{l('Attempts')}: {delivery.attempts}</span>
                              {delivery.response_status !== null && <span className="text-gray-500">HTTP {delivery.response_status}</span>}
                              {delivery.last_error && <span className="basis-full break-words text-rose-400">{delivery.last_error}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className={`mb-3 whitespace-pre-wrap ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{lead.message}</p>
                    {!!visibleFormData.length && (
                      <div className={`mb-3 grid gap-1 rounded-lg border p-2 ${darkMode ? 'border-white/10 bg-black/10' : 'border-gray-100 bg-gray-50'}`}>
                        {visibleFormData.map(([key, value]) => <div key={key} className="grid grid-cols-[90px_1fr] gap-2 text-[10px]"><span className="truncate font-semibold text-gray-500">{key}</span><span className={`break-words ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '')}</span></div>)}
                      </div>
                    )}
                    {lead.notes && <div className={`mb-2 rounded-lg border p-2 text-[10px] ${darkMode ? 'border-amber-500/20 bg-amber-500/5 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><strong>{l('Notes:')}</strong> {lead.notes}</div>}
                    {lead.page_path && <p className="mb-1 text-[10px] text-gray-500">Page: {lead.page_path}</p>}
                    <p className="mb-3 text-[10px] text-gray-500">{new Date(lead.created_at).toLocaleString()}</p>
                    <div className="flex flex-wrap gap-2">
                      {lead.status === 'new' && <button onClick={() => void updateLeadStatus(lead.id, 'read')} className="font-semibold text-emerald-400">{l('Mark read')}</button>}
                      {lead.status !== 'archived' && <button onClick={() => void updateLeadStatus(lead.id, 'archived')} className="font-semibold text-gray-400">{l('Archive')}</button>}
                      <button onClick={() => { const value = window.prompt('Comma-separated tags', (lead.tags || []).join(', ')); if (value !== null) void updateLeadCrm(lead.id, { tags: value.split(',').map((tag) => tag.trim()).filter(Boolean) }); }} className="font-semibold text-amber-400">{l('Tags')}</button>
                      <button onClick={() => { const value = window.prompt('Lead notes', lead.notes || ''); if (value !== null) void updateLeadCrm(lead.id, { notes: value }); }} className="font-semibold text-violet-400">{l('Notes')}</button>
                      <button onClick={() => void copyLeadSummary(lead)} className="font-semibold text-sky-400">{l("Copy")}</button>
                      <button onClick={() => void deleteLead(lead.id)} className="font-semibold text-rose-400">{l('Delete')}</button>
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
  );
}
