import type * as React from 'react';
import type { EditorPageLike,EditorSymbolLike } from '../core/editor-model';
import type { EditorNativeOperation } from '../core/editor-native-operation';
import type { EditorSelection } from '../core/editor-selection';
import { EditorStore } from '../core/editor-store';
import type { WebsiteElement,WebsiteSection,WebsiteSEO } from '../core/types';
import { BILLING_PLAN_DETAILS,BUSINESS_BILLING_ENTITLEMENTS,normalizeHeaderConfig,normalizeTheme } from '../core/website-builder-config';
import type { BillingPlan,WebsiteHeaderConfig,WebsitePage,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import { cloneSymbolElement } from '../core/website-builder-rendering';

interface V2NativeOperationsHandlerDependencies {
  activePageId: string;
  billingEntitlements: import("./website-builder-model").BillingEntitlements;
  billingPlan: BillingPlan;
  clearEditorDragState: () => void;
  headerConfig: WebsiteHeaderConfig;
  homePageId: string;
  pages: WebsitePage[];
  remember: (current: WebsiteSection[], label?: string) => void;
  sections: WebsiteSection[];
  selectedContainerId: string | null;
  selectedElementId: string | null;
  selectedFormFieldId: string | null;
  selectedId: string | null;
  seo: WebsiteSEO;
  setActivePageId: React.Dispatch<React.SetStateAction<string>>;
  setHeaderConfig: React.Dispatch<React.SetStateAction<WebsiteHeaderConfig>>;
  setHomePageId: React.Dispatch<React.SetStateAction<string>>;
  setPages: React.Dispatch<React.SetStateAction<WebsitePage[]>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSections: React.Dispatch<React.SetStateAction<WebsiteSection[]>>;
  setSelectedContainerId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedFormFieldId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setSeo: React.Dispatch<React.SetStateAction<WebsiteSEO>>;
  setSymbols: React.Dispatch<React.SetStateAction<WebsiteSymbol[]>>;
  setTheme: React.Dispatch<React.SetStateAction<WebsiteTheme>>;
  symbols: WebsiteSymbol[];
  theme: WebsiteTheme;
}

export function createV2NativeOperationsHandler({
  activePageId,
  billingEntitlements,
  billingPlan,
  clearEditorDragState,
  headerConfig,
  homePageId,
  pages,
  remember,
  sections,
  selectedContainerId,
  selectedElementId,
  selectedFormFieldId,
  selectedId,
  seo,
  setActivePageId,
  setHeaderConfig,
  setHomePageId,
  setPages,
  setSaved,
  setSections,
  setSelectedContainerId,
  setSelectedElementId,
  setSelectedFormFieldId,
  setSelectedId,
  setSeo,
  setSymbols,
  setTheme,
  symbols,
  theme,
}: V2NativeOperationsHandlerDependencies) {
  return function applyV2NativeOperations(
    operations: EditorNativeOperation[],
    nextSelection?: EditorSelection,
  ) {
    if (!operations.length) return;

    const currentPages =
      pages.map((page) =>
        page.id === activePageId
          ? {
              ...page,
              sections,
            }
          : page,
      );

    const initialSelection:
      EditorSelection = {
        pageId: activePageId,

        ...(selectedId
          ? {
              sectionId:
                selectedId,
            }
          : {}),

        ...(selectedElementId
          ? {
              elementId:
                selectedElementId,
            }
          : {}),

        ...(!selectedElementId &&
        selectedContainerId
          ? {
              containerId:
                selectedContainerId,
            }
          : {}),

        ...(!selectedElementId &&
        !selectedContainerId &&
        selectedFormFieldId
          ? {
              formFieldId:
                selectedFormFieldId,
            }
          : {}),
      };

    const store =
      new EditorStore(
        {
          pages:
            currentPages as unknown as EditorPageLike[],

          homePageId,

          theme: {
            ...theme,
          },

          seo: {
            ...seo,
            keywords: [
              ...seo.keywords,
            ],
          },

          headerConfig: {
            ...headerConfig,
          },

          symbols:
            JSON.parse(
              JSON.stringify(symbols),
            ) as EditorSymbolLike[],
        },
        {
          selection:
            initialSelection,
        },
      );

    const result =
      store.applyNativePatch(
        operations,
        {
          limits: {
            maxPages:
              BUSINESS_BILLING_ENTITLEMENTS.maxPages,
            maxSymbols: 50,
          },
          validateProject: (
            candidate,
            previous,
          ) => {
            const pageCountIncreased =
              candidate.pages.length >
              previous.pages.length;

            if (
              pageCountIncreased &&
              candidate.pages.length >
                billingEntitlements.maxPages
            ) {
              return {
                ok: false,
                errors: [
                  `Your ${BILLING_PLAN_DETAILS[billingPlan].label} plan supports up to ${billingEntitlements.maxPages} pages.`,
                ],
              };
            }

            return {
              ok: true,
            };
          },
        },
      );

    if (
      result.errors.length
    ) {
      console.error(
        '[WebsiteBuilder V2] Native operation failed:',
        {
          operations,
          errors:
            result.errors,
          warnings:
            result.warnings,
        },
      );

      return;
    }

    if (
      !result.changed
    ) {
      console.warn(
        '[WebsiteBuilder V2] Native operation produced no change:',
        operations,
      );

      return;
    }

    const operationLabel = operations.length === 1
      ? operations[0].action.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
      : `${operations.length} manual changes`;

    remember(sections, operationLabel);

    const nextProject =
      store
        .getSnapshot()
        .session
        .project;

    const nextPages =
      nextProject.pages as unknown as WebsitePage[];

    const rawTheme =
      nextProject.theme &&
      typeof nextProject.theme === 'object'
        ? nextProject.theme as Partial<WebsiteTheme>
        : theme;

    const nextTheme =
      normalizeTheme(rawTheme);

    const rawHeaderConfig =
      nextProject.headerConfig &&
      typeof nextProject.headerConfig === 'object'
        ? nextProject.headerConfig as Partial<WebsiteHeaderConfig>
        : headerConfig;

    const nextHeaderConfig =
      normalizeHeaderConfig(
        rawHeaderConfig,
      );

    const rawSeo =
      nextProject.seo &&
      typeof nextProject.seo === 'object'
        ? nextProject.seo as Partial<WebsiteSEO>
        : seo;

    const nextSeo: WebsiteSEO = {
      title:
        typeof rawSeo.title === 'string'
          ? rawSeo.title.trim().slice(0, 160)
          : seo.title,
      description:
        typeof rawSeo.description === 'string'
          ? rawSeo.description.trim().slice(0, 500)
          : seo.description,
      keywords:
        Array.isArray(rawSeo.keywords)
          ? rawSeo.keywords
              .filter(
                (keyword): keyword is string =>
                  typeof keyword === 'string',
              )
              .map((keyword) =>
                keyword.trim().slice(0, 80),
              )
              .filter(Boolean)
              .slice(0, 40)
          : [...seo.keywords],
    };

    const requestedHomePageId =
      typeof nextProject.homePageId === 'string'
        ? nextProject.homePageId.trim()
        : '';

    const nextHomePageId =
      nextPages.some(
        (page) =>
          page.id === requestedHomePageId,
      )
        ? requestedHomePageId
        : nextPages.some(
            (page) =>
              page.id === homePageId,
          )
          ? homePageId
          : nextPages[0]?.id || '';

    const previousSymbolsById =
      new Map(
        symbols.map((symbol) => [
          symbol.id,
          symbol,
        ]),
      );

    const nextSymbols =
      Array.isArray(nextProject.symbols)
        ? nextProject.symbols
            .slice(0, 50)
            .map((rawSymbol) => {
              const id =
                typeof rawSymbol?.id === 'string'
                  ? rawSymbol.id.trim()
                  : '';

              if (
                !id ||
                !rawSymbol?.element
              ) {
                return null;
              }

              const previous =
                previousSymbolsById.get(id);

              const name =
                typeof rawSymbol.name === 'string' &&
                rawSymbol.name.trim()
                  ? rawSymbol.name
                      .trim()
                      .slice(0, 80)
                  : previous?.name ||
                    'Reusable component';

              const element =
                cloneSymbolElement(
                  rawSymbol.element as unknown as WebsiteElement,
                );

              const unchanged =
                Boolean(previous) &&
                previous?.name === name &&
                JSON.stringify(previous.element) ===
                  JSON.stringify(element);

              return {
                id,
                name,
                element,
                updatedAt:
                  unchanged && previous
                    ? previous.updatedAt
                    : new Date().toISOString(),
              } satisfies WebsiteSymbol;
            })
            .filter(
              (
                symbol,
              ): symbol is WebsiteSymbol =>
                Boolean(symbol),
            )
        : symbols;

    const requestedPageId =
      nextSelection?.pageId ||
      activePageId;

    const nextActivePage =
      nextPages.find(
        (page) =>
          page.id ===
          requestedPageId,
      ) ||
      nextPages[0];

    if (!nextActivePage) {
      return;
    }

    clearEditorDragState();
    setPages(nextPages);
    setHomePageId(nextHomePageId);
    setTheme(nextTheme);
    setSeo(nextSeo);
    setHeaderConfig(nextHeaderConfig);
    setSymbols(nextSymbols);

    setActivePageId(
      nextActivePage.id,
    );

    setSections(
      nextActivePage.sections,
    );

    const requestedSectionId =
      nextSelection?.sectionId;

    const nextSection =
      requestedSectionId
        ? nextActivePage
            .sections
            .find(
              (section) =>
                section.id ===
                requestedSectionId,
            )
        : undefined;

    const resolvedSection =
      nextSection ||
      nextActivePage
        .sections[0];

    setSelectedId(
      resolvedSection?.id ??
        null,
    );

    const requestedElementId =
      nextSelection?.elementId;

    const hasRequestedElement =
      Boolean(
        requestedElementId &&
        resolvedSection?.elements
          .some(
            (element) =>
              element.id ===
              requestedElementId,
          ),
      );

    setSelectedElementId(
      hasRequestedElement
        ? requestedElementId!
        : null,
    );

    const requestedContainerId =
      nextSelection?.containerId;

    const hasRequestedContainer =
      Boolean(
        !hasRequestedElement &&
        requestedContainerId &&
        resolvedSection?.containers
          ?.some(
            (container) =>
              container.id ===
              requestedContainerId,
          ),
      );

    setSelectedContainerId(
      hasRequestedContainer
        ? requestedContainerId!
        : null,
    );

    const requestedFormFieldId =
      nextSelection?.formFieldId;

    const hasRequestedFormField =
      Boolean(
        !hasRequestedElement &&
        !hasRequestedContainer &&
        requestedFormFieldId &&
        resolvedSection?.formFields
          ?.some(
            (formField) =>
              formField.id ===
              requestedFormFieldId,
          ),
      );

    setSelectedFormFieldId(
      hasRequestedFormField
        ? requestedFormFieldId!
        : null,
    );

    setSaved(false);
  };
}
