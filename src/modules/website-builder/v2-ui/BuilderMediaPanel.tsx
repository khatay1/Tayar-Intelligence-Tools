import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization';

import type {
  EditorMediaAsset,
  EditorMediaFilter,
} from '../core/editor-media-library';

import {
  filterEditorMediaAssets,
} from '../core/editor-media-library';

export interface BuilderMediaPanelProps {
  assets: EditorMediaAsset[];
  filter?: EditorMediaFilter;

  onFilterChange?(
    filter: EditorMediaFilter,
  ): void;

  onSelect(
    asset: EditorMediaAsset,
  ): void;

  onUpload?(): void;

  onGenerateWithAI?(
    prompt: string,
  ): void | Promise<void>;
}

export function BuilderMediaPanel({
  assets,
  filter = {},
  onFilterChange,
  onSelect,
  onUpload,
  onGenerateWithAI,
}: BuilderMediaPanelProps) {
  const l = useLocalizer();
  const visible =
    filterEditorMediaAssets(
      assets,
      filter,
    );

  const [aiOpen, setAiOpen] =
    useState(false);

  const [aiPrompt, setAiPrompt] =
    useState('');

  const [aiBusy, setAiBusy] =
    useState(false);

  const [aiError, setAiError] =
    useState('');

  async function generate() {
    const prompt =
      aiPrompt.trim();

    if (
      !prompt ||
      !onGenerateWithAI ||
      aiBusy
    ) {
      return;
    }

    setAiBusy(true);
    setAiError('');

    try {
      await onGenerateWithAI(
        prompt,
      );

      setAiPrompt('');
      setAiOpen(false);
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : l('Image generation failed.'),
      );
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="tayar-v2-media-panel">
      <div className="tayar-v2-panel-heading">
        <strong>{l('Media')}</strong>
      </div>

      <div className="tayar-v2-panel-actions">
        {onUpload && (
          <button
            type="button"
            onClick={onUpload}
          >
            {l('Upload')}
          </button>
        )}

        {onGenerateWithAI && (
          <button
            type="button"
            aria-pressed={aiOpen}
            onClick={() => {
              setAiOpen(
                (current) => !current,
              );

              setAiError('');
            }}
          >
            {l('AI image')}
          </button>
        )}
      </div>

      {aiOpen && (
        <div className="tayar-v2-media-ai">
          <input
            autoFocus
            type="text"
            value={aiPrompt}
            placeholder={l('Describe an image...')}
            disabled={aiBusy}
            onChange={(event) =>
              setAiPrompt(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key === 'Enter'
              ) {
                event.preventDefault();
                void generate();
              }
            }}
          />

          <button
            type="button"
            disabled={
              aiBusy ||
              !aiPrompt.trim()
            }
            onClick={() =>
              void generate()
            }
          >
            {aiBusy
              ? l('Generating…')
              : l('Generate')}
          </button>

          {aiError && (
            <div className="tayar-v2-media-ai__error">
              <span>{l(aiError)}</span>

              <button
                type="button"
                disabled={aiBusy || !aiPrompt.trim()}
                onClick={() => void generate()}
              >
                {l('Retry')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="tayar-v2-panel-search">
        <input
          type="search"
          value={
            filter.query || ''
          }
          placeholder={l('Search')}
          aria-label={l('Search media')}
          onChange={(event) =>
            onFilterChange?.({
              ...filter,
              query:
                event.target.value,
            })
          }
        />
      </div>

      <div className="tayar-v2-media-grid">
        {visible.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className="tayar-v2-media-card"
            title={asset.name}
            onClick={() =>
              onSelect(asset)
            }
          >
            <span
              className="tayar-v2-media-card__preview"
              data-kind={
                asset.kind
              }
            >
              {asset.kind ===
              'image' ? (
                <img
                  src={asset.url}
                  alt={
                    asset.alt ||
                    asset.name
                  }
                  loading="lazy"
                />
              ) : (
                <span>
                  {asset.kind.toUpperCase()}
                </span>
              )}
            </span>

            <span className="tayar-v2-media-card__name">
              {asset.name}
            </span>
          </button>
        ))}

        {!visible.length && (
          <div className="tayar-v2-empty-panel">
            {l('No media')}
          </div>
        )}
      </div>
    </div>
  );
}
