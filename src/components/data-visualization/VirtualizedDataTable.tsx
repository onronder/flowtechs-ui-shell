
import React, { useState, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  SortAsc,
  SortDesc,
  Loader2,
  Filter,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type VirtualizedColumn<T> = {
  header: string;
  accessorKey: string;
  cell?: (info: { row: T; getValue: () => any }) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  enableResizing?: boolean;
  size?: number;
  minSize?: number;
  maxSize?: number;
};

export type DataLoadingStatus = 'idle' | 'loading' | 'error' | 'success';

export interface VirtualizedDataTableProps<T> {
  data: T[];
  columns: VirtualizedColumn<T>[];
  totalRows?: number;
  loadingStatus?: DataLoadingStatus;
  errorMessage?: string;
  pageSize?: number;
  pageIndex?: number;
  pageCount?: number;
  containerHeight?: number;
  rowHeight?: number;
  estimateSize?: (index: number) => number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSortChange?: (columnId: string, desc: boolean) => void;
  onFilterChange?: (columnId: string, value: string) => void;
  onRowClick?: (row: T) => void;
  onLoadMore?: () => void;
  loadMoreThreshold?: number;
}

function VirtualizedDataTable<T extends Record<string, any>>({
  data,
  columns,
  totalRows,
  loadingStatus = 'idle',
  errorMessage,
  pageSize = 50,
  pageIndex = 0,
  pageCount,
  containerHeight = 600,
  rowHeight = 48,
  estimateSize,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onFilterChange,
  onRowClick,
  onLoadMore,
  loadMoreThreshold = 10,
}: VirtualizedDataTableProps<T>) {
  const [localFilters, setLocalFilters] = useState<Record<string, string>>({});
  const [localSortBy, setLocalSortBy] = useState<{ id: string; desc: boolean } | null>(null);
  const [internalPageSize, setInternalPageSize] = useState(pageSize);
  const [internalPageIndex, setInternalPageIndex] = useState(pageIndex);

  // Calculate derived values
  const displayData = useMemo(() => data, [data]);
  const isLoading = loadingStatus === 'loading';
  const hasError = loadingStatus === 'error';
  const isEmpty = !isLoading && !hasError && displayData.length === 0;
  
  // Setup virtualizer
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: displayData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateSize || (() => rowHeight),
    overscan: 10,
  });

  // Handle pagination
  const handlePageChange = useCallback((newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage);
    } else {
      setInternalPageIndex(newPage);
    }
  }, [onPageChange]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    } else {
      setInternalPageSize(newSize);
    }
  }, [onPageSizeChange]);

  // Handle sorting
  const handleSortChange = useCallback((columnId: string) => {
    const isDesc = localSortBy?.id === columnId && !localSortBy.desc;
    const newSortBy = { id: columnId, desc: isDesc };
    
    if (onSortChange) {
      onSortChange(columnId, isDesc);
    }
    
    setLocalSortBy(newSortBy);
  }, [localSortBy, onSortChange]);

  // Handle filtering
  const handleFilterChange = useCallback((columnId: string, value: string) => {
    const newFilters = { ...localFilters, [columnId]: value };
    
    if (onFilterChange) {
      onFilterChange(columnId, value);
    }
    
    setLocalFilters(newFilters);
  }, [localFilters, onFilterChange]);

  // Infinite scroll detection
  React.useEffect(() => {
    if (!onLoadMore) return;
    
    const scrollElement = parentRef.current;
    if (!scrollElement) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const scrollBottom = scrollHeight - scrollTop - clientHeight;
      
      if (scrollBottom <= loadMoreThreshold * rowHeight && !isLoading) {
        onLoadMore();
      }
    };
    
    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, isLoading, rowHeight, loadMoreThreshold]);

  // Render loading state
  if (isLoading && !data.length) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-60" />
        </div>
        <div className="border rounded-md">
          <div className="h-[600px] overflow-hidden">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center border-b p-4">
                {Array.from({ length: columns.length }).map((_, j) => (
                  <Skeleton key={j} className="h-6 w-full max-w-[200px] mx-2" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (hasError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="text-sm font-medium">Error loading data</p>
        {errorMessage && <p className="text-xs mt-1">{errorMessage}</p>}
      </div>
    );
  }

  // Render empty state
  if (isEmpty) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No records found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter controls */}
      <div className="flex flex-wrap gap-3">
        {columns
          .filter(column => column.filterable)
          .map(column => (
            <div key={column.accessorKey} className="flex items-center space-x-2">
              <Input
                placeholder={`Filter ${column.header}...`}
                value={localFilters[column.accessorKey] || ''}
                onChange={e => handleFilterChange(column.accessorKey, e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
          ))}
        {Object.keys(localFilters).length > 0 && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              const resetFilters = {};
              Object.keys(localFilters).forEach(key => {
                if (onFilterChange) onFilterChange(key, '');
              });
              setLocalFilters(resetFilters);
            }}
            className="h-8 px-2 text-xs"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div>
          <div className="w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(column => (
                    <TableHead 
                      key={column.accessorKey}
                      className={cn(
                        column.sortable && "cursor-pointer select-none",
                        column.size && `w-[${column.size}px]`,
                        column.minSize && `min-w-[${column.minSize}px]`,
                        column.maxSize && `max-w-[${column.maxSize}px]`
                      )}
                      onClick={() => {
                        if (column.sortable) {
                          handleSortChange(column.accessorKey);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.header}</span>
                        {column.sortable && localSortBy?.id === column.accessorKey && (
                          <span>
                            {localSortBy.desc ? (
                              <SortDesc className="h-4 w-4" />
                            ) : (
                              <SortAsc className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          {/* Virtualized Rows */}
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: containerHeight, width: '100%' }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = displayData[virtualRow.index];
                return (
                  <div
                    key={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <TableRow
                      className={cn(
                        "flex w-full items-center border-b hover:bg-muted/50",
                        onRowClick && "cursor-pointer"
                      )}
                      onClick={() => onRowClick && onRowClick(row)}
                    >
                      {columns.map((column) => (
                        <TableCell
                          key={column.accessorKey}
                          className={cn(
                            "flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-4 py-2",
                            column.size && `w-[${column.size}px]`,
                            column.minSize && `min-w-[${column.minSize}px]`,
                            column.maxSize && `max-w-[${column.maxSize}px]`
                          )}
                        >
                          {column.cell
                            ? column.cell({
                                row,
                                getValue: () => row[column.accessorKey],
                              })
                            : row[column.accessorKey]?.toString() || ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {(pageCount || totalRows) && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            {totalRows
              ? `Showing ${internalPageIndex * internalPageSize + 1}-${Math.min(
                  (internalPageIndex + 1) * internalPageSize,
                  totalRows
                )} of ${totalRows} rows`
              : `Page ${internalPageIndex + 1} of ${pageCount}`}
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <select
                value={internalPageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-8 w-[70px] rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              >
                {[10, 20, 50, 100, 200].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(0)}
                disabled={internalPageIndex === 0 || isLoading}
                className="h-8 w-8 p-0"
              >
                <span className="sr-only">Go to first page</span>
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 -ml-2" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(internalPageIndex - 1)}
                disabled={internalPageIndex === 0 || isLoading}
                className="h-8 w-8 p-0"
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(internalPageIndex + 1)}
                disabled={
                  (pageCount !== undefined && internalPageIndex >= pageCount - 1) || isLoading
                }
                className="h-8 w-8 p-0"
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pageCount ? pageCount - 1 : 0)}
                disabled={
                  (pageCount !== undefined && internalPageIndex >= pageCount - 1) || isLoading
                }
                className="h-8 w-8 p-0"
              >
                <span className="sr-only">Go to last page</span>
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator for infinite scroll */}
      {isLoading && data.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export { VirtualizedDataTable };
