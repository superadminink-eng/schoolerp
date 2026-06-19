import React from "react";
import { Button } from "./button";
import { Icon } from "./icon";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  loading = false,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-outline-variant/60 bg-surface-container-lowest px-4 py-3 sm:px-6 mt-4 rounded-xl">
      <div className="flex flex-1 justify-between sm:hidden">
        <Button
          variant="outlined"
          disabled={currentPage === 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outlined"
          disabled={currentPage === totalPages || loading}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </Button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-on-surface-variant">
            Showing{" "}
            <span className="font-semibold text-on-surface">
              {(currentPage - 1) * itemsPerPage + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-on-surface">
              {Math.min(currentPage * itemsPerPage, totalItems)}
            </span>{" "}
            of <span className="font-semibold text-on-surface">{totalItems}</span> results
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="tonal"
            className="w-10 h-10 p-0 rounded-full"
            disabled={currentPage === 1 || loading}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <Icon name="chevron_left" size={20} />
          </Button>
          <span className="text-sm font-semibold text-on-surface-variant">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="tonal"
            className="w-10 h-10 p-0 rounded-full"
            disabled={currentPage === totalPages || loading}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <Icon name="chevron_right" size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}
