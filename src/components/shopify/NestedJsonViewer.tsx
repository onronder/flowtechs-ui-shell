
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Search, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { NestedJsonViewerProps } from '../graphql/types';

export default function NestedJsonViewer({
  data,
  expandedByDefault = false,
  maxDepth = 3,
  searchEnabled = true,
  pathCopyEnabled = true,
}: NestedJsonViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const togglePath = (path: string) => {
    const newPaths = new Set(expandedPaths);
    if (newPaths.has(path)) {
      newPaths.delete(path);
    } else {
      newPaths.add(path);
    }
    setExpandedPaths(newPaths);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: `${label} has been copied to your clipboard.`,
    });
  };

  const isPathExpanded = (path: string): boolean => {
    return expandedPaths.has(path) || expandedByDefault;
  };

  const shouldShowNode = (key: string, value: any, path: string[]): boolean => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    const keyMatches = key.toLowerCase().includes(searchLower);
    const valueMatches = typeof value === 'string' && value.toLowerCase().includes(searchLower);
    const pathMatches = path.join('.').toLowerCase().includes(searchLower);
    
    return keyMatches || valueMatches || pathMatches;
  };

  const renderNode = (
    key: string,
    value: any,
    path: string[] = [],
    depth: number = 0
  ): React.ReactNode => {
    const currentPath = [...path, key];
    const pathString = currentPath.join('.');
    
    if (!shouldShowNode(key, value, currentPath)) {
      return null;
    }

    // Primitive values
    if (
      value === null ||
      value === undefined ||
      typeof value !== 'object'
    ) {
      return (
        <div key={pathString} className="py-1">
          <div className="flex items-center gap-1">
            <span className="font-medium text-blue-600 dark:text-blue-400">{key}:</span>
            <span className={`
              ${value === null ? 'text-gray-500 italic' : ''}
              ${typeof value === 'number' ? 'text-green-600 dark:text-green-400' : ''}
              ${typeof value === 'boolean' ? 'text-purple-600 dark:text-purple-400' : ''}
              ${typeof value === 'string' ? 'text-amber-600 dark:text-amber-400' : ''}
            `}>
              {value === null ? 'null' : 
               typeof value === 'string' ? `"${value}"` : 
               String(value)}
            </span>
            {pathCopyEnabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(
                    typeof value === 'string' ? value : JSON.stringify(value),
                    'Value'
                  );
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      );
    }
    
    // Arrays and Objects
    const isExpanded = isPathExpanded(pathString);
    const isArray = Array.isArray(value);
    const isEmpty = isArray ? value.length === 0 : Object.keys(value).length === 0;
    
    // Don't allow expansion beyond max depth
    const canExpand = depth < maxDepth;
    
    return (
      <div key={pathString} className="py-1">
        <div 
          className="flex items-center cursor-pointer" 
          onClick={() => canExpand && !isEmpty ? togglePath(pathString) : undefined}
        >
          {!isEmpty && canExpand ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 mr-1 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-1 text-gray-500" />
            )
          ) : (
            <div className="w-4 mr-1" />
          )}
          
          <span className="font-medium text-blue-600 dark:text-blue-400">{key}:</span>
          
          {isEmpty ? (
            <span className="text-gray-500 ml-1">
              {isArray ? '[]' : '{}'}
            </span>
          ) : (
            <span className="text-gray-500 ml-1">
              {isArray ? `Array(${value.length})` : `Object(${Object.keys(value).length} properties)`}
            </span>
          )}
          
          {pathCopyEnabled && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 ml-1"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(pathString, 'Path');
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {!isEmpty && isExpanded && canExpand && (
          <div className="pl-5 border-l border-gray-200 dark:border-gray-700 ml-2 mt-1">
            {isArray
              ? value.map((item: any, index: number) => 
                  renderNode(String(index), item, currentPath, depth + 1)
                )
              : Object.entries(value).map(([k, v]) => 
                  renderNode(k, v, currentPath, depth + 1)
                )
            }
          </div>
        )}
      </div>
    );
  };

  const renderJson = () => {
    if (!data) {
      return <div className="text-gray-500">No data to display</div>;
    }

    return (
      <div className="font-mono text-sm">
        {typeof data === 'object' && data !== null
          ? (
              Array.isArray(data)
                ? data.map((item, index) => renderNode(String(index), item, [], 0))
                : Object.entries(data).map(([key, value]) => renderNode(key, value, [], 0))
            )
          : (
              <div className="py-1">
                <span className={`
                  ${typeof data === 'number' ? 'text-green-600 dark:text-green-400' : ''}
                  ${typeof data === 'boolean' ? 'text-purple-600 dark:text-purple-400' : ''}
                  ${typeof data === 'string' ? 'text-amber-600 dark:text-amber-400' : ''}
                `}>
                  {JSON.stringify(data)}
                </span>
              </div>
            )
        }
      </div>
    );
  };

  return (
    <div className="w-full">
      {searchEnabled && (
        <div className="mb-4 flex items-center">
          <Search className="mr-2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search keys, values, or paths..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
      )}
      
      <ScrollArea className="h-[calc(100vh-14rem)]">
        {renderJson()}
      </ScrollArea>
    </div>
  );
}
