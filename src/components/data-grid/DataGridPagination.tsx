import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface DataGridPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  selectedRowsCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export function DataGridPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  selectedRowsCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: DataGridPaginationProps) {
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handleFirstPage = () => {
    onPageChange(1);
  }

  const handleLastPage = () => {
    onPageChange(totalPages);
  }

  const startItem = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4">
      <div className="text-sm text-muted-foreground">
        {selectedRowsCount > 0
          ? `${selectedRowsCount} of ${totalItems} row(s) selected.`
          : totalItems > 0 ? `Showing ${startItem}-${endItem} of ${totalItems} items.` : 'No items to display.'}
      </div>
      <div className="flex items-center space-x-2 sm:space-x-4">
        <div className="flex items-center space-x-1">
          <span className="text-sm text-muted-foreground hidden sm:inline">Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages > 0 ? totalPages : 1}
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={handleFirstPage}
            disabled={currentPage === 1 || totalPages === 0}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={handlePreviousPage}
            disabled={currentPage === 1 || totalPages === 0}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={handleNextPage}
            disabled={currentPage === totalPages || totalPages === 0}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={handleLastPage}
            disabled={currentPage === totalPages || totalPages === 0}
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
