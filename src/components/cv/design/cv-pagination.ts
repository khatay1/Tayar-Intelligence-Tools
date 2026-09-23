import { CVLayoutSettings, getCVContentHeightMm } from './cv-layout';

export interface CVMeasuredBlock {
  id: string;
  sectionId: string;
  heightMm: number;
  keepTogether?: boolean;
  keepWithNext?: boolean;
}

export interface CVPagePlan {
  page: number;
  blockIds: string[];
  usedHeightMm: number;
  overflow: boolean;
}

export function paginateCVBlocks(blocks: CVMeasuredBlock[], layout: CVLayoutSettings): CVPagePlan[] {
  const capacity = getCVContentHeightMm(layout);
  const pages: CVPagePlan[] = [];
  let current: CVPagePlan = { page: 1, blockIds: [], usedHeightMm: 0, overflow: false };

  const pushPage = () => {
    if (current.blockIds.length) pages.push(current);
    current = { page: pages.length + 1, blockIds: [], usedHeightMm: 0, overflow: false };
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const next = blocks[index + 1];
    const pairedHeight = block.keepWithNext && next ? block.heightMm + next.heightMm : block.heightMm;
    const needsFreshPage = current.blockIds.length > 0 && current.usedHeightMm + pairedHeight > capacity;

    if (needsFreshPage) pushPage();

    current.blockIds.push(block.id);
    current.usedHeightMm += block.heightMm;
    if (block.heightMm > capacity || current.usedHeightMm > capacity) current.overflow = true;
  }

  pushPage();
  return pages.length ? pages : [{ page: 1, blockIds: [], usedHeightMm: 0, overflow: false }];
}

export function findCVOverflowPages(pages: CVPagePlan[]): number[] {
  return pages.filter(page => page.overflow).map(page => page.page);
}
