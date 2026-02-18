/**
 * Cursor-Based Pagination Utility
 * Provides efficient pagination for large datasets without offset-based queries
 * which can be slow on large tables
 */

export interface PaginationParams {
  cursor?: string; // Base64-encoded cursor from previous response
  limit?: number; // Items per page (default: 50, max: 500)
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string; // Cursor for next page, undefined if no more items
  hasMore: boolean;
  count: number;
}

/**
 * Encode cursor for pagination
 * Cursor format: "id:timestamp" encoded in base64
 */
export function encodeCursor(id: number, timestamp: Date): string {
  const cursorData = `${id}:${timestamp.getTime()}`;
  return Buffer.from(cursorData).toString("base64");
}

/**
 * Decode cursor for pagination
 */
export function decodeCursor(
  cursor: string
): { id: number; timestamp: Date } | null {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const [idStr, timestampStr] = decoded.split(":");
    const id = parseInt(idStr, 10);
    const timestamp = new Date(parseInt(timestampStr, 10));

    if (isNaN(id) || isNaN(timestamp.getTime())) {
      return null;
    }

    return { id, timestamp };
  } catch {
    return null;
  }
}

/**
 * Validate and normalize pagination parameters
 */
export function normalizePaginationParams(params?: PaginationParams): {
  cursor?: { id: number; timestamp: Date };
  limit: number;
} {
  const limit = Math.min(params?.limit || 50, 500); // Cap at 500 items per page

  if (!params?.cursor) {
    return { limit };
  }

  const decodedCursor = decodeCursor(params.cursor);
  if (!decodedCursor) {
    console.warn("[Pagination] Invalid cursor provided, ignoring");
    return { limit };
  }

  return { cursor: decodedCursor, limit };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<
  T extends { id: number; exitDate?: Date; createdAt?: Date },
>(items: T[], _limit: number, hasMore: boolean): PaginatedResponse<T> {
  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor(
          items[items.length - 1]!.id,
          items[items.length - 1]!.exitDate ||
            items[items.length - 1]!.createdAt ||
            new Date()
        )
      : undefined;

  return {
    items,
    nextCursor,
    hasMore,
    count: items.length,
  };
}

/**
 * Example usage in getTrades:
 *
 * export async function getTradesPaginated(
 *   params?: {
 *     strategyIds?: number[];
 *     startDate?: Date;
 *     endDate?: Date;
 *     pagination?: PaginationParams;
 *   }
 * ): Promise<PaginatedResponse<Trade>> {
 *   const db = await getDb();
 *   if (!db) return { items: [], hasMore: false, count: 0 };
 *
 *   const { cursor, limit } = normalizePaginationParams(params?.pagination);
 *   const conditions = [];
 *
 *   // ... build conditions ...
 *
 *   // Add cursor-based filtering for pagination
 *   if (cursor) {
 *     conditions.push(
 *       or(
 *         gt(trades.exitDate, cursor.timestamp),
 *         and(
 *           eq(trades.exitDate, cursor.timestamp),
 *           gt(trades.id, cursor.id)
 *         )
 *       )
 *     );
 *   }
 *
 *   // Fetch limit + 1 to determine if there are more items
 *   const results = await db
 *     .select()
 *     .from(trades)
 *     .where(and(...conditions))
 *     .orderBy(trades.exitDate, trades.id)
 *     .limit(limit + 1);
 *
 *   const hasMore = results.length > limit;
 *   const items = results.slice(0, limit);
 *
 *   return createPaginatedResponse(items, limit, hasMore);
 * }
 */
