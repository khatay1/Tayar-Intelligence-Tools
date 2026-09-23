import { useMemo, useState, type ComponentProps } from 'react';
import { BuilderCmsPanel as BuilderCmsCorePanel } from './BuilderCmsCorePanel';
import { BuilderCmsLocalizationPanel } from './BuilderCmsLocalizationPanel';
import { BuilderCmsTransferPanel } from './BuilderCmsTransferPanel';

type BuilderCmsPanelProps = ComponentProps<typeof BuilderCmsCorePanel>;

export function BuilderCmsPanel(props: BuilderCmsPanelProps) {
  const { cms, disabled, onChange } = props;
  const [transferCollectionId, setTransferCollectionId] = useState(cms.collections[0]?.id || '');
  const transferCollection = useMemo(
    () => cms.collections.find((item) => item.id === transferCollectionId) || cms.collections[0],
    [cms.collections, transferCollectionId],
  );

  return <div data-testid="builder-cms-max-panel">
    <div className="space-y-2 px-3 pt-3">
      {cms.collections.length > 1 && <select
        className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-400"
        value={transferCollection?.id || ''}
        onChange={(event) => setTransferCollectionId(event.target.value)}
        disabled={disabled}
        aria-label="CMS transfer collection"
      >
        {cms.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
      </select>}
      <BuilderCmsTransferPanel
        cms={cms}
        collection={transferCollection}
        disabled={disabled}
        onChange={onChange}
        onImportedCollection={setTransferCollectionId}
      />
      <BuilderCmsLocalizationPanel cms={cms} disabled={disabled} onChange={onChange} />
    </div>
    <BuilderCmsCorePanel {...props} />
  </div>;
}
