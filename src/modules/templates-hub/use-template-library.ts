import { useEffect, useRef, useState } from 'react';
import {
  listMirroredTemplates,
  MirroredTemplatePage,
  MirroredTemplateQuery,
} from './library-service';

const EMPTY_PAGE: MirroredTemplatePage = {
  items: [],
  page: 1,
  pageSize: 36,
  total: 0,
  totalPages: 1,
};

export function useTemplateLibrary(query: MirroredTemplateQuery, enabled = true) {
  const [result, setResult] = useState<MirroredTemplatePage>(EMPTY_PAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const id = requestId.current + 1;
    requestId.current = id;
    setLoading(true);
    setError('');

    const timer = window.setTimeout(() => {
      void listMirroredTemplates(query)
        .then((next) => {
          if (requestId.current !== id) return;
          setResult(next);
        })
        .catch((reason: unknown) => {
          if (requestId.current !== id) return;
          setError(reason instanceof Error ? reason.message : 'Template library is unavailable.');
        })
        .finally(() => {
          if (requestId.current === id) setLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, query.category, query.format, query.page, query.pageSize, query.query]);

  return {
    ...result,
    loading,
    error,
  };
}
