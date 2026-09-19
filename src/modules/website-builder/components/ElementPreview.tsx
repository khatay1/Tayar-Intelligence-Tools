import { useEffect, useRef, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import type { Device, WebsiteElement } from '../core/types';
import {
  clampElementNumber, effectiveStyle, elementShadowCss, parseRichRows,
  safeEmbedUrl, sanitizeCustomHtml, videoSource,
} from '../core/website-builder-rendering';

export function ElementPreview({
  element,
  selected,
  dragging,
  dragOver,
  device,
  onSelect,
  onDragStart,
  onDragMove,
  onPointerDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onInlineContentChange,
  onInlineSourceChange,
}: {
  element: WebsiteElement;
  selected: boolean;
  dragging: boolean;
  dragOver: boolean;
  device: Device;
  onSelect: (additive?: boolean, range?: boolean) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragMove: (e: React.DragEvent) => void;
  onPointerDragStart: (e: React.PointerEvent<HTMLElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onInlineContentChange: (content: string) => void;
  onInlineSourceChange: (src: string) => void;
}) {
  const l = useLocalizer();
  const style = effectiveStyle(element, device);
  const [hovered, setHovered] = useState(false);
  const [editingInline, setEditingInline] = useState(false);
  const inlineEditRef = useRef<HTMLElement | null>(null);
  const inlineEditable = element.type === 'heading' || element.type === 'text' || element.type === 'button';

  useEffect(() => {
    if (!editingInline || !inlineEditRef.current) return;
    inlineEditRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(inlineEditRef.current);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, [editingInline]);
  const rotate = clampElementNumber(style.rotate, 0, -180, 180);
  const positionX = clampElementNumber(style.positionX, 0, -4000, 4000);
  const positionY = clampElementNumber(style.positionY, 0, -4000, 4000);
  const hoverScale = hovered ? clampElementNumber(style.hoverScale, 1, 0.5, 1.6) : 1;
  const commonStyle = {
    color: hovered && style.hoverColor ? style.hoverColor : style.color,
    backgroundColor: hovered && style.hoverBackgroundColor ? style.hoverBackgroundColor : style.backgroundColor,
    fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
    fontWeight: style.fontWeight,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing !== undefined ? `${style.letterSpacing}px` : undefined,
    padding: style.padding ? `${style.padding}px` : undefined,
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
    borderStyle: style.borderWidth ? (style.borderStyle || 'solid') : undefined,
    borderColor: style.borderColor,
    boxShadow: elementShadowCss(hovered && style.hoverShadow ? style.hoverShadow : style.shadow),
    opacity: hovered && style.hoverOpacity !== undefined ? style.hoverOpacity : style.opacity,
    transform: `translate3d(${positionX}px, ${positionY}px, 0) rotate(${rotate}deg) scale(${hoverScale})`,
    transition: 'transform .2s ease, opacity .2s ease, background-color .2s ease, color .2s ease, box-shadow .2s ease, border-color .2s ease',
    width: style.width ? `${style.width}%` : undefined,
  } as const;

  const wrapper = `relative max-w-full rounded-lg outline-none transition duration-150 ${editingInline ? 'cursor-text' : 'cursor-grab active:cursor-grabbing'} ${
    selected ? 'ring-2 ring-violet-400/90 shadow-[0_0_0_4px_rgba(139,92,246,0.08)]' : 'hover:ring-1 hover:ring-violet-400/40'
  } ${dragging ? 'scale-[0.99] opacity-55 shadow-xl' : 'opacity-100'} ${dragOver ? 'ring-2 ring-cyan-400/80' : ''}`;

  const commitInlineEdit = () => {
    if (!editingInline) return;
    const next = (inlineEditRef.current?.textContent || '').replace(/\u00a0/g, ' ').trim();
    setEditingInline(false);
    if (next && next !== element.content) onInlineContentChange(next);
  };

  const cancelInlineEdit = () => {
    if (inlineEditRef.current) inlineEditRef.current.textContent = element.content;
    setEditingInline(false);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelInlineEdit();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      inlineEditRef.current?.blur();
    }
  };

  const dragProps = {
    'data-tayar-canvas-element-id': element.id,
    'data-tayar-canvas-position-x': String(positionX),
    'data-tayar-canvas-position-y': String(positionY),
    draggable: !editingInline,
    onDragStart: (e: React.DragEvent) => {
      if (editingInline) { e.preventDefault(); return; }
      e.stopPropagation(); onDragStart(e);
    },
    onDrag: (e: React.DragEvent) => {
      if (editingInline) return;
      e.stopPropagation();
      onDragMove(e);
    },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (editingInline || e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey) return;
      const interactiveTarget = (e.target as HTMLElement).closest<HTMLElement>('button, input, textarea, select, a, [contenteditable="true"]');
      if (interactiveTarget && interactiveTarget !== e.currentTarget) return;
      e.preventDefault();
      e.stopPropagation();
      if (!selected) onSelect(false);
      onPointerDragStart(e);
    },
    onDragOver: (e: React.DragEvent) => { e.stopPropagation(); onDragOver(e); },
    onDrop: (e: React.DragEvent) => { e.stopPropagation(); onDrop(e); },
    onDragEnd: (e: React.DragEvent) => { e.stopPropagation(); onDragEnd(); },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      const additive = e.metaKey || e.ctrlKey;
      const range = e.shiftKey;
      if (additive || range || !selected) onSelect(additive, range);
    },
    onDoubleClick: (e: React.MouseEvent) => {
      if (element.type === 'image' || element.type === 'video' || element.type === 'embed') {
        e.preventDefault();
        e.stopPropagation();
        onSelect(false);
        const sourceLabel = element.type === 'image' ? 'Image URL' : element.type === 'video' ? 'Video URL' : 'Embed URL';
        const nextSource = window.prompt(sourceLabel, element.src || '')?.trim();
        if (nextSource && nextSource !== element.src) onInlineSourceChange(nextSource);
        return;
      }
      if (!inlineEditable) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect(false);
      setEditingInline(true);
    },
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (element.type === 'heading') {
    return <h2 {...dragProps} ref={(node) => { inlineEditRef.current = node; }} contentEditable={editingInline} suppressContentEditableWarning onBlur={commitInlineEdit} onKeyDown={handleInlineKeyDown} className={`${wrapper} ${editingInline ? 'ring-2 ring-cyan-400/80 bg-black/10' : ''}`} style={commonStyle} title={editingInline ? 'Press Enter to finish · Esc to cancel' : 'Double-click to edit text'}>{element.content}</h2>;
  }
  if (element.type === 'text') {
    return <p {...dragProps} ref={(node) => { inlineEditRef.current = node; }} contentEditable={editingInline} suppressContentEditableWarning onBlur={commitInlineEdit} onKeyDown={handleInlineKeyDown} className={`${wrapper} ${editingInline ? 'ring-2 ring-cyan-400/80 bg-black/10' : ''}`} style={commonStyle} title={editingInline ? 'Press Enter to finish · Esc to cancel' : 'Double-click to edit text'}>{element.content}</p>;
  }
  if (element.type === 'button') {
    return <button {...dragProps} ref={(node) => { inlineEditRef.current = node; }} type="button" contentEditable={editingInline} suppressContentEditableWarning onBlur={commitInlineEdit} onKeyDown={handleInlineKeyDown} className={`${wrapper} ${editingInline ? 'ring-2 ring-cyan-400/80 bg-black/10' : ''}`} style={commonStyle} title={editingInline ? 'Press Enter to finish · Esc to cancel' : 'Double-click to edit button text'}>{element.content}</button>;
  }
  if (element.type === 'list') {
    const items = (element.content || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    return <ul {...dragProps} className={`${wrapper} list-disc space-y-2 pl-6`} style={commonStyle}>{items.map((item, index) => <li key={`${element.id}-${index}`}>{item}</li>)}</ul>;
  }
  if (element.type === 'divider') {
    return <div {...dragProps} className={`${wrapper} py-2`} style={{ ...commonStyle, backgroundColor: 'transparent', padding: undefined, borderWidth: undefined, boxShadow: undefined }}><div style={{ height: '2px', width: '100%', background: style.backgroundColor || '#7c3aed', opacity: style.opacity ?? 0.35 }} /></div>;
  }
  if (element.type === 'spacer') {
    const height = Math.max(8, Math.min(320, (clampElementNumber(style.padding, 24, 0, 160) || 24) * 2));
    return <div {...dragProps} className={`${wrapper} flex w-full items-center justify-center border border-dashed border-white/10 text-[10px] text-gray-500`} style={{ ...commonStyle, height: `${height}px` }}>{l('Spacer')} {height}px</div>;
  }
  if (element.type === 'video') {
    const source = videoSource(element.src || '');
    return (
      <div {...dragProps} className={`${wrapper} overflow-hidden`} style={commonStyle} title={l('Double-click to edit video URL')}>
        {source?.kind === 'iframe' ? <iframe src={source.src} title={element.content || l('Video')} className="aspect-video w-full border-0" /> : source?.kind === 'video' ? <video src={source.src} controls className="h-auto w-full" /> : <div className="flex min-h-40 w-full items-center justify-center border border-dashed border-white/20 bg-black/20 px-6 text-center text-xs text-gray-400">{l('Double-click to add a video URL')}</div>}
      </div>
    );
  }
  if (element.type === 'accordion') {
    const rows = parseRichRows(element.content);
    return <div {...dragProps} className={`${wrapper} w-full space-y-2 text-left`} style={commonStyle}>{rows.map((row, index) => <details key={`${element.id}-accordion-${index}`} open={index === 0} className="rounded-lg border border-white/10 bg-white/5 px-3"><summary className="cursor-pointer py-3 font-bold">{row.title}</summary><p className="pb-3 text-sm opacity-75">{row.body}</p></details>)}</div>;
  }
  if (element.type === 'tabs') {
    const rows = parseRichRows(element.content);
    return <div {...dragProps} className={`${wrapper} w-full`} style={commonStyle}><div className="mb-2 flex flex-wrap gap-2">{rows.map((row, index) => <span key={`${element.id}-tab-${index}`} className={`rounded-lg border px-3 py-2 text-xs font-bold ${index === 0 ? 'border-violet-400 bg-violet-500/15' : 'border-white/10 bg-white/5'}`}>{row.title}</span>)}</div><div className="rounded-lg border border-white/10 bg-white/5 p-4 text-left text-sm opacity-80">{rows[0]?.body || l('Add tab content')}</div></div>;
  }
  if (element.type === 'gallery') {
    const images = (element.content || '').split(/\r?\n/).map((item) => safeEmbedUrl(item)).filter(Boolean);
    return <div {...dragProps} className={`${wrapper} grid w-full grid-cols-2 gap-2 md:grid-cols-3`} style={commonStyle}>{images.length ? images.map((src, index) => <img key={`${element.id}-gallery-${index}`} src={src} alt={`Gallery ${index + 1}`} className="aspect-[4/3] w-full rounded-lg object-cover" draggable={false} />) : <div className="col-span-full flex min-h-32 items-center justify-center border border-dashed border-white/20 text-xs text-gray-400">{l('Add one image URL per line')}</div>}</div>;
  }
  if (element.type === 'embed') {
    const source = safeEmbedUrl(element.src || '');
    return <div {...dragProps} className={`${wrapper} w-full overflow-hidden`} style={commonStyle} title={l('Double-click to edit embed URL')}>{source ? <iframe src={source} title={element.content || l('Embedded content')} className="aspect-video w-full border-0" /> : <div className="flex min-h-44 items-center justify-center border border-dashed border-white/20 px-6 text-center text-xs text-gray-400">{l('Double-click to add an embeddable URL')}</div>}</div>;
  }
  if (element.type === 'countdown') {
    const [target, ...labelParts] = (element.content || '').split('|');
    return <div {...dragProps} className={`${wrapper} w-full`} style={commonStyle}><p className="mb-3 text-xs font-semibold opacity-70">{labelParts.join('|').trim() || l('Countdown')}</p><div className="grid grid-cols-4 gap-2">{['Days','Hours','Minutes','Seconds'].map((label) => <div key={label} className="rounded-lg border border-white/10 bg-black/15 p-3"><strong className="block text-xl">00</strong><span className="text-[9px] uppercase opacity-60">{l(label)}</span></div>)}</div><p className="mt-2 text-[9px] opacity-50">{l('Target:')} {target.trim() || l('set date in inspector')}</p></div>;
  }
  if (element.type === 'stats') {
    const rows = parseRichRows(element.content);
    return <div {...dragProps} className={`${wrapper} grid w-full grid-cols-1 gap-2 sm:grid-cols-3`} style={commonStyle}>{rows.map((row, index) => <div key={`${element.id}-stat-${index}`} className="rounded-xl border border-white/10 bg-black/10 p-4 text-center"><strong className="block text-2xl">{row.title}</strong><span className="text-xs opacity-65">{row.body}</span></div>)}</div>;
  }
  if (element.type === 'testimonials-slider') {
    const rows = parseRichRows(element.content);
    const first = rows[0];
    return <div {...dragProps} className={`${wrapper} w-full`} style={commonStyle}><div className="rounded-xl border border-white/10 bg-black/10 p-5 text-center"><p className="text-sm italic opacity-85">“{first?.body || l('Add testimonial text')}”</p><strong className="mt-3 block text-xs">— {first?.title || l('Customer')}</strong></div><div className="mt-2 text-center text-[9px] opacity-50">Slider preview • {rows.length} testimonials</div></div>;
  }
  if (element.type === 'code') {
    return <div {...dragProps} className={`${wrapper} w-full overflow-hidden`} style={commonStyle}><div className="pointer-events-none" dangerouslySetInnerHTML={{ __html: sanitizeCustomHtml(element.content) }} /></div>;
  }
  if (element.type === 'image') {
    return (
      <div {...dragProps} className={`${wrapper} overflow-hidden`} style={commonStyle} title={l('Double-click to replace image')}>
        {element.src ? (
          <img src={element.src} alt={element.content || l('Website image')} className="h-auto w-full object-cover" draggable={false} />
        ) : (
          <div className="flex min-h-32 w-full items-center justify-center border border-dashed border-white/20 bg-white/5 px-6 text-xs text-gray-400">{l('Double-click to add image URL')}</div>
        )}
      </div>
    );
  }
  return <div {...dragProps} className={`${wrapper} overflow-hidden`} style={commonStyle}>{element.content}</div>;
}
