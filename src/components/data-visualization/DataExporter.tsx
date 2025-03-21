import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download, FileJson, FileSpreadsheet, FileText, Loader2, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type ExportFormatType = 'json' | 'csv' | 'excel';
export type ExportScheduleType = 'once' | 'daily' | 'weekly' | 'monthly';
export type ExportFilterType = 'all' | 'changed' | 'filtered';

export interface DataExporterProps<T> {
  data: T[] | (() => Promise<T[]>);
  filename?: string;
  columns?: Array<{
    header: string;
    accessorKey: string;
    includeInExport?: boolean;
  }>;
  totalCount?: number;
  enableStreamingExport?: boolean;
  enableScheduledExports?: boolean;
  enableIncrementalExports?: boolean;
  onExport?: (format: ExportFormatType, options: ExportOptions) => Promise<void>;
  isLoading?: boolean;
}

export interface ExportOptions {
  filename: string;
  format: ExportFormatType;
  includeAllData: boolean;
  includeColumns: string[];
  scheduledExport: boolean;
  scheduleType?: ExportScheduleType;
  scheduleEmail?: string;
  exportFilter: ExportFilterType;
  compressionEnabled: boolean;
  encrypt: boolean;
}

const defaultExportOptions: ExportOptions = {
  filename: 'export',
  format: 'json',
  includeAllData: false,
  includeColumns: [],
  scheduledExport: false,
  exportFilter: 'all',
  compressionEnabled: true,
  encrypt: false,
};

function DataExporter<T>({
  data,
  filename = 'export',
  columns = [],
  totalCount = 0,
  enableStreamingExport = false,
  enableScheduledExports = false,
  enableIncrementalExports = false,
  onExport,
  isLoading = false,
}: DataExporterProps<T>) {
  const { toast } = useToast();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    ...defaultExportOptions,
    filename,
    includeColumns: columns.filter(col => col.includeInExport !== false).map(col => col.accessorKey),
  });
  const [exportInProgress, setExportInProgress] = useState(false);

  const handleExportClick = (format: ExportFormatType) => {
    // For simple exports, just trigger the export directly
    if (!enableStreamingExport && !enableScheduledExports && !enableIncrementalExports) {
      handleExport({ ...exportOptions, format });
      return;
    }
    
    // For advanced exports, open the dialog
    setExportOptions(prev => ({ ...prev, format }));
    setExportDialogOpen(true);
  };

  const handleExport = async (options: ExportOptions) => {
    try {
      setExportInProgress(true);
      
      // If custom export handler provided, use it
      if (onExport) {
        await onExport(options.format, options);
        toast({
          title: 'Export started',
          description: options.scheduledExport 
            ? 'Your export has been scheduled' 
            : 'Your export is being prepared',
        });
        setExportDialogOpen(false);
        return;
      }
      
      // Otherwise perform client-side export
      const exportData = typeof data === 'function' ? await data() : data;
      
      let exportContent: string;
      let mimeType: string;
      let fileExtension: string;
      
      // Format the data based on the selected format
      if (options.format === 'json') {
        exportContent = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        fileExtension = 'json';
      } else if (options.format === 'csv') {
        // Simple CSV generation - production implementation would be more robust
        const headers = options.includeColumns.length 
          ? options.includeColumns 
          : Object.keys(exportData[0] || {});
          
        const csvRows = [
          headers.join(','),
          ...exportData.map(row => 
            headers.map(field => JSON.stringify(row[field] || '')).join(',')
          )
        ];
        
        exportContent = csvRows.join('\n');
        mimeType = 'text/csv';
        fileExtension = 'csv';
      } else {
        // Excel format would require a library like xlsx in a real implementation
        throw new Error('Excel export requires server-side processing');
      }
      
      // Create and download the file
      const blob = new Blob([exportContent], { type: mimeType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${options.filename}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Export completed',
        description: `Your data has been exported as ${fileExtension.toUpperCase()}`,
      });
      
      setExportDialogOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setExportInProgress(false);
    }
  };
  
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Export Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExportClick('json')}>
            <FileJson className="mr-2 h-4 w-4" />
            Export as JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportClick('csv')}>
            <FileText className="mr-2 h-4 w-4" />
            Export as CSV
          </DropdownMenuItem>
          {enableStreamingExport && (
            <DropdownMenuItem onClick={() => handleExportClick('excel')}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export as Excel
            </DropdownMenuItem>
          )}
          {enableScheduledExports && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => {
                  setExportOptions(prev => ({ 
                    ...prev, 
                    scheduledExport: true,
                    format: 'csv' 
                  }));
                  setExportDialogOpen(true);
                }}
              >
                <Clock className="mr-2 h-4 w-4" />
                Schedule Export
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Advanced Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Export Options</DialogTitle>
            <DialogDescription>
              Configure your export settings. {totalCount > 1000 && "This dataset is large, streaming is recommended."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="filename">File name</Label>
              <Input
                id="filename"
                value={exportOptions.filename}
                onChange={(e) => setExportOptions(prev => ({ ...prev, filename: e.target.value }))}
                placeholder="export-filename"
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Format</Label>
              <Select
                value={exportOptions.format}
                onValueChange={(value: ExportFormatType) => 
                  setExportOptions(prev => ({ ...prev, format: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  {enableStreamingExport && (
                    <SelectItem value="excel">Excel</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeAllData"
                checked={exportOptions.includeAllData}
                onCheckedChange={(checked) => 
                  setExportOptions(prev => ({ 
                    ...prev, 
                    includeAllData: checked === true 
                  }))
                }
              />
              <Label htmlFor="includeAllData">
                {totalCount > 0 
                  ? `Include all ${totalCount.toLocaleString()} records` 
                  : 'Include all records'}
              </Label>
            </div>
            
            {enableIncrementalExports && (
              <div className="grid gap-2">
                <Label>Export Filter</Label>
                <Select
                  value={exportOptions.exportFilter}
                  onValueChange={(value: ExportFilterType) => 
                    setExportOptions(prev => ({ ...prev, exportFilter: value as ExportFilterType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Export filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All records</SelectItem>
                    <SelectItem value="changed">Changed records only</SelectItem>
                    <SelectItem value="filtered">Currently filtered records</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {enableScheduledExports && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scheduledExport"
                    checked={exportOptions.scheduledExport}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ 
                        ...prev, 
                        scheduledExport: checked === true 
                      }))
                    }
                  />
                  <Label htmlFor="scheduledExport">Schedule this export</Label>
                </div>
                
                {exportOptions.scheduledExport && (
                  <>
                    <div className="grid gap-2">
                      <Label>Schedule Type</Label>
                      <Select
                        value={exportOptions.scheduleType || 'once'}
                        onValueChange={(value: ExportScheduleType) => 
                          setExportOptions(prev => ({ ...prev, scheduleType: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Schedule type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once">One time</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="email">Delivery Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={exportOptions.scheduleEmail || ''}
                        onChange={(e) => setExportOptions(prev => ({ 
                          ...prev, 
                          scheduleEmail: e.target.value 
                        }))}
                        placeholder="email@example.com"
                      />
                    </div>
                  </>
                )}
              </>
            )}
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="compression"
                checked={exportOptions.compressionEnabled}
                onCheckedChange={(checked) => 
                  setExportOptions(prev => ({ 
                    ...prev, 
                    compressionEnabled: checked === true 
                  }))
                }
              />
              <Label htmlFor="compression">Enable compression</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="encrypt"
                checked={exportOptions.encrypt}
                onCheckedChange={(checked) => 
                  setExportOptions(prev => ({ 
                    ...prev, 
                    encrypt: checked === true 
                  }))
                }
              />
              <Label htmlFor="encrypt">Encrypt export file</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setExportDialogOpen(false)}
              disabled={exportInProgress}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => handleExport(exportOptions)}
              disabled={exportInProgress}
            >
              {exportInProgress ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                'Export'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { DataExporter };
