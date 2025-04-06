import {z} from "zod";

export function getCommonMetadataSchema() {
  return z.object({
    current_page: z.number(),
    per_page: z.number(),
    items_count: z.number(),
    pages_count: z.number()
  });
}

export function getCommonMetadataValue({
  page,
  perPage,
  resultCount
}: {
  page: number;
  perPage: number;
  resultCount: number;
}) {
  return {
    current_page: page,
    per_page: perPage,
    pages_count: Math.ceil(resultCount / perPage),
    items_count: resultCount,
  };
}