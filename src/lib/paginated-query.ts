/** Read a deterministically ordered query without mistaking the API row cap for the total. */
export async function readAllRows<T>(createQuery: () => {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  try {
    for (let offset = 0; ; ) {
      const result = await createQuery().range(offset, offset + 499);
      if (result.error) return { data: [], error: result.error };
      if (!result.data?.length) return { data: rows, error: null };
      rows.push(...result.data);
      // Use returned size: the server can enforce a smaller limit than requested.
      offset += result.data.length;
    }
  } catch (error) {
    return { data: [], error: { message: error instanceof Error ? error.message : 'Query failed' } };
  }
}
