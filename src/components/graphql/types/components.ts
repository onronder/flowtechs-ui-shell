
// ShopifyDataTable types
export interface ShopifyDataTableProps {
  data: any[];
  columns: DataTableColumn[];
  pagination?: PaginationOptions;
  loading?: boolean;
  error?: string;
  onRowClick?: (row: any) => void;
}

export interface DataTableColumn {
  id: string;
  header: string;
  accessorKey?: string;
  accessorFn?: (row: any) => any;
  cell?: (info: { getValue: () => any; row: { original: any } }) => React.ReactNode;
  enableSorting?: boolean;
  enableFiltering?: boolean;
}

export interface PaginationOptions {
  pageSize: number;
  pageIndex: number;
  pageCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

// NestedJsonViewer types
export interface NestedJsonViewerProps {
  data: any;
  expandedByDefault?: boolean;
  maxDepth?: number;
  searchEnabled?: boolean;
  pathCopyEnabled?: boolean;
}

// QueryEditor props
export interface QueryEditorProps {
  generatedQuery: string;
  isExecuting: boolean;
  complexity: number;
  onExecute: () => void;
  onCopy?: (text: string) => void;
  onSave?: () => void;
  onDownload?: () => void;
  height?: string;
}
