import { useMemo, useState } from 'react';
import {
  EDITOR_INTEGRATION_PROVIDERS,
  getEditorIntegrationProvider,
  validateEditorIntegrations,
  type EditorIntegrationConnection,
  type EditorIntegrationEnvironment,
  type EditorIntegrationEvent,
  type EditorIntegrationsConfig,
} from '../core/editor-integrations';

interface Props {
  config: EditorIntegrationsConfig;
  onChange(config: EditorIntegrationsConfig): void;
  onSetSecret?(connectionId: string, field: string, value: string): void | Promise<void>;
  onTestConnection?(connectionId: string): void | Promise<void>;
}

const environments: EditorIntegrationEnvironment[] = ['preview', 'staging', 'production'];

function createConnection(providerId: string): EditorIntegrationConnection {
  const provider = getEditorIntegrationProvider(providerId)!;
  const now = new Date().toISOString();
  return { id: `${providerId}-${Date.now().toString(36)}`, providerId, name: provider.name, enabled: true, status: 'disconnected', environments: ['production'], config: {}, secrets: {}, events: provider.supportedEvents?.slice(0, 1) ?? [], createdAt: now, updatedAt: now };
}

export function BuilderIntegrationsMaxPanel({ config, onChange, onSetSecret, onTestConnection }: Props) {
  const [providerId, setProviderId] = useState(EDITOR_INTEGRATION_PROVIDERS[0]?.id ?? '');
  const [testing, setTesting] = useState<string>();
  const issues = useMemo(() => validateEditorIntegrations(config), [config]);
  const patch = (id: string, change: Partial<EditorIntegrationConnection>) => onChange({ ...config, connections: config.connections.map(item => item.id === id ? { ...item, ...change, updatedAt: new Date().toISOString() } : item) });

  return <section className="builder-v2-card" data-testid="integrations-max-panel">
    <div className="builder-v2-card__header"><div><strong>Integrations</strong><p>Connect analytics, payments, email, CRM, APIs and signed webhooks.</p></div><span>{config.connections.filter(item => item.enabled).length} active</span></div>
    <div className="builder-v2-grid"><label>Provider<select value={providerId} onChange={event => setProviderId(event.target.value)}>{EDITOR_INTEGRATION_PROVIDERS.map(provider => <option key={provider.id} value={provider.id}>{provider.name} · {provider.category}</option>)}</select></label><button type="button" onClick={() => onChange({ ...config, connections: [...config.connections, createConnection(providerId)] })}>Add integration</button></div>
    {issues.length > 0 && <div className="builder-v2-card builder-v2-card--nested"><strong>{issues.length} configuration issue{issues.length === 1 ? '' : 's'}</strong>{issues.slice(0, 6).map((issue, index) => <small key={`${issue.connectionId}-${issue.field}-${index}`}>{issue.message}</small>)}</div>}
    {config.connections.map(connection => {
      const provider = getEditorIntegrationProvider(connection.providerId);
      if (!provider) return null;
      return <div className="builder-v2-card builder-v2-card--nested" key={connection.id}>
        <div className="builder-v2-card__header"><div><strong>{connection.name}</strong><small>{provider.description}</small></div><label>Enabled <input type="checkbox" checked={connection.enabled} onChange={event => patch(connection.id,{enabled:event.target.checked,status:event.target.checked?connection.status:'disabled'})}/></label></div>
        <label>Name<input value={connection.name} onChange={event => patch(connection.id,{name:event.target.value})}/></label>
        <div className="builder-v2-grid">{provider.fields.map(field => field.secret ? <label key={field.key}>{field.label}<input type="password" autoComplete="new-password" placeholder={connection.secrets[field.key]?.ref ? 'Configured — enter to replace' : field.placeholder} onBlur={async event => { const value=event.target.value; if(!value||!onSetSecret)return; await onSetSecret(connection.id,field.key,value); event.target.value=''; }}/></label> : <label key={field.key}>{field.label}<input type={field.type==='url'?'url':'text'} value={String(connection.config[field.key] ?? '')} placeholder={field.placeholder} onChange={event => patch(connection.id,{config:{...connection.config,[field.key]:event.target.value}})}/></label>)}</div>
        <fieldset><legend>Environments</legend>{environments.map(environment => <label key={environment}><input type="checkbox" checked={connection.environments.includes(environment)} onChange={event => patch(connection.id,{environments:event.target.checked?[...new Set([...connection.environments,environment])]:connection.environments.filter(item=>item!==environment)})}/>{environment}</label>)}</fieldset>
        {!!provider.supportedEvents?.length && <fieldset><legend>Events</legend>{provider.supportedEvents.map(event => <label key={event}><input type="checkbox" checked={connection.events?.includes(event) ?? false} onChange={change => patch(connection.id,{events:change.target.checked?[...new Set([...(connection.events??[]),event]) as EditorIntegrationEvent]:connection.events?.filter(item=>item!==event)})}/>{event}</label>)}</fieldset>}
        <div className="builder-v2-grid"><button type="button" disabled={!onTestConnection||testing===connection.id} onClick={async()=>{if(!onTestConnection)return;setTesting(connection.id);try{await onTestConnection(connection.id);}finally{setTesting(undefined);}}}>{testing===connection.id?'Testing…':'Test connection'}</button><button type="button" onClick={()=>onChange({...config,connections:config.connections.filter(item=>item.id!==connection.id)})}>Remove</button></div>
      </div>;
    })}
  </section>;
}

export default BuilderIntegrationsMaxPanel;
