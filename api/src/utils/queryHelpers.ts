export function getMultipleStringQueryValues<T extends number | string>(queryValues: T | T[] | undefined): T[] {
  if (!queryValues) {
    return [];
  }

  const queryValuesToSearch: T[] = [];
  if (Array.isArray(queryValues)) {
    queryValuesToSearch.push(...queryValues);
  } else {
    if (queryValues.toString().includes(',')) {
      queryValuesToSearch.push(...queryValues.toString().split(',') as T[]);
    } else {
      queryValuesToSearch.push(queryValues);
    }
  }
  return queryValuesToSearch;
}

