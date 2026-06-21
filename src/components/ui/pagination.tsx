"use client";

import { Button } from "./button";

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  if (total === 0 || total <= limit) return null;

  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
      <span className="text-body-sm text-on-surface-variant">
        Showing {start}&ndash;{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outlined"
          size="sm"
          icon="chevron_left"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        />
        <span className="text-body-sm text-on-surface-variant px-2">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outlined"
          size="sm"
          icon="chevron_right"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        />
      </div>
    </div>
  );
}
