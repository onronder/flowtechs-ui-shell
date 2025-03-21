import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTableColumn, PaginationOptions } from "../graphql/types";

interface ShopifyDataTableProps {
  data: any[];
  columns: DataTableColumn[];
  pagination?: PaginationOptions;
  loading?: boolean;
  error?: string;
  onRowClick?: (row: any) => void;
}

const ShopifyDataTable: React.FC<ShopifyDataTableProps> = ({
  data,
  columns,
  pagination,
  loading,
  error,
  onRowClick,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: () => 
      getPaginationRowModel({ pageSize }),
    onSortingChange: setSorting,
    state: {
      sorting,
      pagination: {
        pageIndex: pagination?.pageIndex || 0,
        pageSize: pagination?.pageSize || 10,
      },
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    manualSorting: false,
  });

  const headerGroups = table.getHeaderGroups();
  const pageRows = table.getRowModel().rows;

  const handlePageChange = (page: number) => {
    if (pagination && pagination.onPageChange) {
      pagination.onPageChange(page);
      table.setPageIndex(page);
    }
  };

  const handlePageSizeChange = (size: number) => {
    if (pagination && pagination.onPageSizeChange) {
      pagination.onPageSizeChange(size);
      table.setPageSize(size);
    }
  };

  const renderHeader = (header: any) => {
    const isSortable = header.column.columnDef.enableSorting !== false;
    const isSorted = header.column.getIsSorted();

    return (
      <TableHead key={header.id} className="group">
        {isSortable ? (
          <Button
            variant="ghost"
            onClick={header.column.getToggleSortingHandler()}
            className="w-full justify-start gap-2"
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
            {isSorted === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : isSorted === "desc" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-50" />
            )}
          </Button>
        ) : (
          flexRender(header.column.columnDef.header, header.getContext())
        )}
      </TableHead>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Data Table</CardTitle>
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Filter columns..."
            value={(table.getColumn("id")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("id")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => {
              handlePageSizeChange(Number(value));
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={String(pageSize)}>
                  {pageSize} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-8rem)]">
        {loading ? (
          <div className="flex flex-col space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : data.length === 0 ? (
          <Alert>
            <AlertDescription>No data available.</AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="rounded-md border">
            <Table>
              <TableHeader>
                {headerGroups.map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(renderHeader)}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => {
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => onRowClick && onRowClick(row.original)}
                      className="cursor-pointer hover:bg-accent"
                    >
                      {row.getVisibleCells().map((cell) => {
                        return (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
        {pagination && (
          <div className="flex items-center justify-between p-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {table.getFilteredRowModel().rows.length} row(s)
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(0)}
                disabled={!table.getCanPreviousPage()}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(table.getState().pagination.pageIndex - 1)}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
              >
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(table.getState().pagination.pageIndex + 1)}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShopifyDataTable;
