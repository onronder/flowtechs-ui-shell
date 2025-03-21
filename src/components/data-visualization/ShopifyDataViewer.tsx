
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualizedDataTable, VirtualizedColumn } from './VirtualizedDataTable';
import { DataExporter } from './DataExporter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Filter, Search, SlidersHorizontal, MoreHorizontal, FileJson, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { extractIdFromGid, convertToDataset, Dataset, getRateLimitInfo } from '@/integrations/supabase/client';

// Helper to determine data type for column formatting
const getDataType = (value: any): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) return 'datetime';
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'date';
    if (value.startsWith('gid://')) return 'id';
    if (value.match(/^https?:\/\//)) return 'url';
    if (value.length > 100) return 'longtext';
  }
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
};

// Format value based on its type
const formatValue = (value: any, type: string): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  
  switch (type) {
    case 'boolean':
      return value ? 'true' : 'false';
      
    case 'datetime':
      return new Date(value).toLocaleString();
      
    case 'date':
      return new Date(value).toLocaleDateString();
      
    case 'id':
      if (typeof value === 'string' && value.startsWith('gid://')) {
        return (
          <span title={value} className="font-mono">
            {extractIdFromGid(value)}
          </span>
        );
      }
      return value;
      
    case 'url':
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline truncate max-w-[200px] inline-block"
        >
          {new URL(value).hostname}
        </a>
      );
      
    case 'array':
      return <Badge variant="outline">{`Array(${value.length})`}</Badge>;
      
    case 'object':
      return <Badge variant="outline" className="bg-slate-100">Object</Badge>;
      
    case 'longtext':
      return (
        <span title={value} className="truncate max-w-[200px] inline-block">
          {value}
        </span>
      );
      
    default:
      return value;
  }
};

// Auto-generate columns from data
const generateColumns = <T extends Record<string, any>>(
  data: T[],
  options?: {
    exclude?: string[];
    prioritize?: string[];
  }
): VirtualizedColumn<T>[] => {
  if (!data.length) return [];
  
  const exclude = options?.exclude || [];
  const prioritize = options?.prioritize || [];
  
  // Collect all possible keys and their data types
  const keys = new Set<string>();
  const types: Record<string, string> = {};
  
  data.slice(0, 100).forEach(item => {
    Object.keys(item).forEach(key => {
      if (!exclude.includes(key)) {
        keys.add(key);
        
        // Determine type from first non-null value we find
        if (!(key in types) || types[key] === 'null') {
          types[key] = getDataType(item[key]);
        }
      }
    });
  });
  
  // Sort keys with prioritized ones first
  const sortedKeys = [...keys].sort((a, b) => {
    const aIndex = prioritize.indexOf(a);
    const bIndex = prioritize.indexOf(b);
    
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    
    // Secondary sort by whether a field has 'id' in it
    const aHasId = a.toLowerCase().includes('id');
    const bHasId = b.toLowerCase().includes('id');
    
    if (aHasId && !bHasId) return -1;
    if (!aHasId && bHasId) return 1;
    
    return a.localeCompare(b);
  });
  
  // Generate columns
  return sortedKeys.map(key => ({
    header: key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase()),
    accessorKey: key,
    sortable: true,
    filterable: true,
    cell: ({ row, getValue }) => {
      const value = getValue();
      const type = types[key] || getDataType(value);
      return formatValue(value, type);
    },
  }));
};

export interface ShopifyDataViewerProps {
  data: any[];
  dataset?: Dataset;
  loading?: boolean;
  error?: string | null;
  viewMode?: 'table' | 'json' | 'chart';
  onViewModeChange?: (mode: 'table' | 'json' | 'chart') => void;
  columns?: VirtualizedColumn<any>[];
  title?: string;
  description?: string;
  pagination?: {
    pageIndex: number;
    pageSize: number;
    pageCount?: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
  onRowClick?: (row: any) => void;
  onExport?: (format: string, options: any) => Promise<void>;
  onRefresh?: () => void;
  enableStreamingExport?: boolean;
  enableScheduledExports?: boolean;
  enableIncrementalExports?: boolean;
  performance?: {
    loading: 'progressive' | 'batch' | 'complete';
    progress?: number;
    totalRecords?: number;
    loadedRecords?: number;
    executionTime?: number;
  };
}

function ShopifyDataViewer({
  data,
  dataset,
  loading = false,
  error = null,
  viewMode = 'table',
  onViewModeChange,
  columns: propColumns,
  title = 'Shopify Data',
  description,
  pagination,
  onRowClick,
  onExport,
  onRefresh,
  enableStreamingExport = false,
  enableScheduledExports = false,
  enableIncrementalExports = false,
  performance,
}: ShopifyDataViewerProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [localViewMode, setLocalViewMode] = useState(viewMode);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  
  // Handle view mode changes
  useEffect(() => {
    if (viewMode !== localViewMode) {
      setLocalViewMode(viewMode);
    }
  }, [viewMode]);
  
  const handleViewModeChange = (mode: 'table' | 'json' | 'chart') => {
    setLocalViewMode(mode);
    if (onViewModeChange) {
      onViewModeChange(mode);
    }
  };
  
  // Generate columns
  const columns = useMemo(() => {
    if (propColumns) return propColumns;
    return generateColumns(data, {
      prioritize: ['id', 'title', 'name', 'email', 'created_at', 'updated_at'],
    });
  }, [data, propColumns]);
  
  // Apply search filtering
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return data.filter(item => {
      return Object.values(item).some(val => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(lowerSearchTerm);
      });
    });
  }, [data, searchTerm]);
  
  // Toggle column visibility
  const handleToggleColumn = (columnKey: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  };
  
  // Reset column visibility
  const handleResetColumns = () => {
    setColumnVisibility({});
  };
  
  // Visible columns
  const visibleColumns = useMemo(() => {
    return columns.filter(col => !columnVisibility[col.accessorKey]);
  }, [columns, columnVisibility]);
  
  // Handle refresh
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      toast({
        title: 'Refreshing data',
        description: 'The data is being refreshed from the source',
      });
    }
  };
  
  return (
    <Card className="border border-border/50">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search all fields..."
                className="pl-8 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Column Visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2 max-h-[300px] overflow-auto">
                  {columns.map((column) => (
                    <DropdownMenuItem
                      key={column.accessorKey}
                      onClick={() => handleToggleColumn(column.accessorKey)}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={!columnVisibility[column.accessorKey]}
                        onChange={() => {}}
                        className="h-4 w-4"
                      />
                      <span>{column.header}</span>
                    </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={handleResetColumns}
                  >
                    Reset Columns
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* View Mode Selector */}
            <Tabs
              value={localViewMode}
              onValueChange={handleViewModeChange as (value: string) => void}
              className="h-9"
            >
              <TabsList className="h-9">
                <TabsTrigger 
                  value="table" 
                  className="px-3 h-8"
                >
                  Table
                </TabsTrigger>
                <TabsTrigger 
                  value="json" 
                  className="px-3 h-8"
                >
                  JSON
                </TabsTrigger>
                <TabsTrigger 
                  value="chart" 
                  className="px-3 h-8"
                >
                  Chart
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Exporter */}
            <DataExporter
              data={filteredData}
              filename={dataset?.name || 'shopify-export'}
              columns={columns}
              totalCount={dataset?.record_count || filteredData.length}
              enableStreamingExport={enableStreamingExport}
              enableScheduledExports={enableScheduledExports}
              enableIncrementalExports={enableIncrementalExports}
              onExport={onExport}
              isLoading={loading}
            />
            
            {/* Additional Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-3">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRefresh}>
                  Refresh Data
                </DropdownMenuItem>
                {dataset && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(dataset.id);
                        toast({ title: 'Dataset ID copied to clipboard' });
                      }}
                    >
                      Copy Dataset ID
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Performance/extraction progress indicator */}
        {performance && performance.loading !== 'complete' && performance.progress !== undefined && (
          <div className="mt-2">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>
                {performance.loading === 'progressive' ? 'Loading data progressively' : 'Loading data in batches'}
              </span>
              <span>
                {performance.loadedRecords !== undefined && performance.totalRecords !== undefined && 
                  `${performance.loadedRecords.toLocaleString()} / ${performance.totalRecords.toLocaleString()} records`}
              </span>
            </div>
            <Progress value={performance.progress} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <TabsContent value="table" className="m-0">
          <VirtualizedDataTable
            data={filteredData}
            columns={visibleColumns}
            loadingStatus={loading ? 'loading' : error ? 'error' : 'success'}
            errorMessage={error || undefined}
            containerHeight={600}
            rowHeight={48}
            onRowClick={onRowClick}
            {...pagination}
          />
        </TabsContent>
        
        <TabsContent value="json" className="m-0">
          <div className="border rounded-md h-[600px] overflow-auto bg-slate-50">
            <pre className="p-4 text-sm font-mono">
              {JSON.stringify(filteredData, null, 2)}
            </pre>
          </div>
        </TabsContent>
        
        <TabsContent value="chart" className="m-0">
          <div className="border rounded-md h-[600px] overflow-auto flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Chart visualization will be generated based on data type.</p>
              <p className="text-sm text-muted-foreground mt-2">Select specific fields to visualize.</p>
            </div>
          </div>
        </TabsContent>
      </CardContent>
    </Card>
  );
}

export { ShopifyDataViewer };
