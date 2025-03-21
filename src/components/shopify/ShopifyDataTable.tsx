
import { useState, useMemo, useCallback } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Search,
  Loader2,
} from "lucide-react";
import { DataTableColumn, PaginationOptions } from "../graphql/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ShopifyDataTableProps<TData> {
  title?: string;
  description?: string;
  data: TData[];
  columns: DataTableColumn[];
  pagination?: PaginationOptions;
  loading?: boolean;
  error?: string;
  onRowClick?: (row: TData) => void;
  emptyState?: React.ReactNode;
  className?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  height?: string;
}

export function ShopifyDataTable<TData>({
  title,
  description,
  data,
  columns,
  pagination,
  loading = false,
  error,
  onRowClick,
  emptyState,
  className,
  enableSearch = true,
  searchPlaceholder = "Search...",
  height = "600px",
}: ShopifyDataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // Convert the generic columns to TanStack Table's ColumnDef
  const tableColumns = useMemo<ColumnDef<TData>[]>(() => {
    return columns.map((col) => {
      return {
        id: col.id,
        header: ({ column }) => {
          return col.enableSorting === false ? (
            <div>{col.header}</div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              {col.header}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        accessorKey: col.accessorKey,
        accessorFn: col.accessorFn,
        cell: col.cell
          ? ({ row }) => col.cell!({ getValue: () => row.getValue(col.id), row: { original: row.original } })
          : ({ row }) => {
              const value = row.getValue(col.id);
              // Handle different data types for display
              if (value === null || value === undefined) return "-";
              if (typeof value === "boolean") return value ? "Yes" : "No";
              if (typeof value === "object") return JSON.stringify(value);
              return String(value);
            },
        enableSorting: col.enableSorting,
        enableColumnFilter: col.enableFiltering,
      };
    });
  }, [columns]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter,
      pagination: pagination
        ? {
            pageIndex: pagination.pageIndex,
            pageSize: pagination.pageSize,
          }
        : undefined,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!pagination,
    pageCount: pagination?.pageCount,
  });

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setGlobalFilter(e.target.value);
    },
    []
  );

  return (
    <Card className={cn("w-full", className)}>
      {(title || description) && (
        <CardHeader className="pb-3">
          {title && <CardTitle>{title}</CardTitle>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
      )}

      <CardContent className="p-0">
        {enableSearch && (
          <div className="flex items-center px-4 py-2 border-b">
            <Search className="h-4 w-4 mr-2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={handleSearchChange}
              className="flex h-8 w-full rounded-md border-0 bg-transparent text-sm shadow-none"
            />
          </div>
        )}

        {loading ? (
          <div className="w-full py-24 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading data...</span>
          </div>
        ) : error ? (
          <div className="w-full py-24 flex flex-col items-center justify-center text-center px-4">
            <Badge variant="destructive" className="mb-2">
              Error
            </Badge>
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="w-full py-24 flex flex-col items-center justify-center">
            {emptyState || (
              <div className="text-center px-4">
                <p className="text-muted-foreground">No data available</p>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <ScrollArea
              className={`rounded-md border`}
              style={{ height }}
            >
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      className={onRowClick ? "cursor-pointer hover:bg-accent" : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {pagination && (
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="flex-1 text-sm text-muted-foreground">
                  {pagination.pageSize * pagination.pageIndex + 1} -{" "}
                  {Math.min(
                    pagination.pageSize * (pagination.pageIndex + 1),
                    pagination.pageCount ? pagination.pageCount * pagination.pageSize : Infinity
                  )}{" "}
                  of{" "}
                  {pagination.pageCount
                    ? pagination.pageCount * pagination.pageSize
                    : "many"}
                </div>
                <div className="flex items-center space-x-6 lg:space-x-8">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Rows per page</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-8 w-[70px]"
                        >
                          {pagination.pageSize}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                          <DropdownMenuItem
                            key={pageSize}
                            onClick={() => pagination.onPageSizeChange?.(pageSize)}
                          >
                            {pageSize}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => pagination.onPageChange(0)}
                      disabled={pagination.pageIndex === 0}
                    >
                      <span className="sr-only">Go to first page</span>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
                      disabled={pagination.pageIndex === 0}
                    >
                      <span className="sr-only">Go to previous page</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center justify-center text-sm font-medium">
                      Page {pagination.pageIndex + 1} of{" "}
                      {pagination.pageCount || "?"}
                    </div>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
                      disabled={
                        !pagination.pageCount ||
                        pagination.pageIndex === pagination.pageCount - 1
                      }
                    >
                      <span className="sr-only">Go to next page</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() =>
                        pagination.pageCount &&
                        pagination.onPageChange(pagination.pageCount - 1)
                      }
                      disabled={
                        !pagination.pageCount ||
                        pagination.pageIndex === pagination.pageCount - 1
                      }
                    >
                      <span className="sr-only">Go to last page</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
