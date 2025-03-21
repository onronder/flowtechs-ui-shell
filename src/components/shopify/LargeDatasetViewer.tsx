
import { useState, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Search, Filter, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { NestedJsonViewer } from "./NestedJsonViewer";
import { ShopifyDataTable } from "./ShopifyDataTable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LargeDatasetViewerProps {
  data: any[];
  title?: string;
  columns?: { id: string; header: string; accessorKey: string }[];
  loading?: boolean;
  error?: string | null;
  height?: string;
  className?: string;
  onRowClick?: (row: any) => void;
  onDownload?: () => void;
  onFilterChange?: (filters: Record<string, any>) => void;
}

export function LargeDatasetViewer({
  data,
  title = "Dataset Viewer",
  columns,
  loading = false,
  error = null,
  height = "700px",
  className,
  onRowClick,
  onDownload,
  onFilterChange,
}: LargeDatasetViewerProps) {
  const [activeTab, setActiveTab] = useState<"table" | "json" | "tree">("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const parentRef = useRef<HTMLDivElement>(null);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;

    const searchLower = searchTerm.toLowerCase();
    return data.filter(item => {
      return Object.entries(item).some(([key, value]) => {
        if (typeof value === "string") {
          return value.toLowerCase().includes(searchLower);
        }
        if (typeof value === "number") {
          return value.toString().includes(searchLower);
        }
        return false;
      });
    });
  }, [data, searchTerm]);

  // Generate columns if not provided
  const derivedColumns = useMemo(() => {
    if (columns) return columns;

    // If no columns provided, derive from data
    if (data.length === 0) return [];

    // Get flat keys from first item
    const sampleItem = data[0];
    return Object.keys(sampleItem)
      .filter(key => {
        const value = sampleItem[key];
        // Exclude complex objects for table view
        return (
          value === null ||
          typeof value !== "object" ||
          Object.keys(value || {}).length === 0
        );
      })
      .map(key => ({
        id: key,
        header: key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, str => str.toUpperCase()),
        accessorKey: key,
      }));
  }, [data, columns]);

  // Setup virtualization
  const virtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // estimated row height
    overscan: 10,
  });

  // Handle search input change
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    },
    []
  );

  // Toggle row expanded state
  const toggleRowExpanded = useCallback((id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Handle row clicking
  const handleRowClick = useCallback(
    (row: any) => {
      if (onRowClick) {
        onRowClick(row);
      }
    },
    [onRowClick]
  );

  // Generate unique ID for a row
  const getRowId = useCallback((row: any): string => {
    return row.id || JSON.stringify(row);
  }, []);

  // Virtual row renderer
  const VirtualRow = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = filteredData[index];
      if (!item) return null;

      const rowId = getRowId(item);
      const isExpanded = expandedRows.has(rowId);

      return (
        <div
          className={cn(
            "border-b border-gray-200 dark:border-gray-800",
            index % 2 === 0 ? "bg-white dark:bg-gray-950" : "bg-gray-50 dark:bg-gray-900"
          )}
          style={style}
        >
          <div
            className="flex items-center p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => toggleRowExpanded(rowId)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 mr-2"
              onClick={e => {
                e.stopPropagation();
                toggleRowExpanded(rowId);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>

            <div className="flex-1 grid grid-cols-3 gap-4">
              {derivedColumns.slice(0, 3).map((col) => {
                const value = item[col.accessorKey];
                return (
                  <div key={col.id} className="overflow-hidden">
                    <div className="font-medium text-xs text-gray-500 dark:text-gray-400">
                      {col.header}
                    </div>
                    <div className="truncate">
                      {value === null || value === undefined
                        ? "-"
                        : typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="ml-2"
              onClick={(e) => {
                e.stopPropagation();
                handleRowClick(item);
              }}
            >
              <Button variant="ghost" size="sm">
                View
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="p-3 pl-10 bg-gray-50 dark:bg-gray-900/50">
              <pre className="text-xs overflow-auto max-h-40">
                {JSON.stringify(item, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    },
    [filteredData, derivedColumns, expandedRows, toggleRowExpanded, handleRowClick, getRowId]
  );

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {filteredData.length} of {data.length} records
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              disabled={!onDownload || loading}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <div className="px-4 py-2 border-b flex items-center space-x-2">
        <div className="relative flex-grow">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-8"
          />
        </div>
        {onFilterChange && (
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        )}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="tree">Tree</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <CardContent className="p-0">
        {loading ? (
          <div className="w-full flex items-center justify-center" style={{ height }}>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading data...</span>
          </div>
        ) : error ? (
          <div className="w-full flex flex-col items-center justify-center" style={{ height }}>
            <Badge variant="destructive" className="mb-2">
              Error
            </Badge>
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : (
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="table" className="w-full m-0">
              <ShopifyDataTable
                data={filteredData}
                columns={derivedColumns}
                onRowClick={handleRowClick}
                height={height}
                pagination={{
                  pageSize: 50,
                  pageIndex: 0,
                  onPageChange: () => {},
                }}
              />
            </TabsContent>

            <TabsContent value="json" className="w-full m-0">
              <div ref={parentRef} style={{ height, overflow: "auto" }}>
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => (
                    <VirtualRow
                      key={virtualRow.index}
                      index={virtualRow.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tree" className="w-full m-0">
              <NestedJsonViewer
                data={filteredData}
                height={height}
                expandedByDefault={false}
                searchEnabled={true}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
