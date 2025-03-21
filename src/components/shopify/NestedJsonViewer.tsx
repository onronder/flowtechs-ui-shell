
import React, { useState, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown, Copy, Search, X, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface NestedJsonViewerProps {
  data: any;
  title?: string;
  expandedByDefault?: boolean;
  maxDepth?: number;
  searchEnabled?: boolean;
  pathCopyEnabled?: boolean;
  className?: string;
  height?: string;
}

interface NodeProps {
  path: string[];
  data: any;
  level: number;
  isExpanded: boolean;
  onToggle: (path: string[]) => void;
  maxDepth: number;
  searchTerm: string;
  matchedPaths: Set<string>;
  onCopyPath: (path: string) => void;
  pathCopyEnabled: boolean;
}

const getDataType = (data: any): string => {
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';
  if (Array.isArray(data)) return 'array';
  return typeof data;
};

const getNodeKey = (path: string[]): string => path.join('.');

const formatValue = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') return '';
  return String(value);
};

// The individual node component for each property
const JsonNode: React.FC<NodeProps> = ({
  path,
  data,
  level,
  isExpanded,
  onToggle,
  maxDepth,
  searchTerm,
  matchedPaths,
  onCopyPath,
  pathCopyEnabled,
}) => {
  const nodeKey = getNodeKey(path);
  const dataType = getDataType(data);
  const isExpandable = ['object', 'array'].includes(dataType) && data !== null;
  const hasChildren = isExpandable && Object.keys(data).length > 0;
  const isSearchMatched = searchTerm && matchedPaths.has(nodeKey);
  const propertyName = path[path.length - 1];
  
  // Hide nodes beyond max depth
  if (level > maxDepth) return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(path);
    }
  };

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyPath(nodeKey);
  };

  // Get the rendered children for expandable nodes
  const renderedChildren = useMemo(() => {
    if (isExpandable && hasChildren && isExpanded) {
      if (Array.isArray(data)) {
        return data.map((item, index) => (
          <JsonNode
            key={`${nodeKey}.${index}`}
            path={[...path, String(index)]}
            data={item}
            level={level + 1}
            isExpanded={false}
            onToggle={onToggle}
            maxDepth={maxDepth}
            searchTerm={searchTerm}
            matchedPaths={matchedPaths}
            onCopyPath={onCopyPath}
            pathCopyEnabled={pathCopyEnabled}
          />
        ));
      } else {
        return Object.keys(data).map(key => (
          <JsonNode
            key={`${nodeKey}.${key}`}
            path={[...path, key]}
            data={data[key]}
            level={level + 1}
            isExpanded={false}
            onToggle={onToggle}
            maxDepth={maxDepth}
            searchTerm={searchTerm}
            matchedPaths={matchedPaths}
            onCopyPath={onCopyPath}
            pathCopyEnabled={pathCopyEnabled}
          />
        ));
      }
    }
    return null;
  }, [data, hasChildren, isExpanded, isExpandable, level, maxDepth, nodeKey, onCopyPath, onToggle, path, pathCopyEnabled, searchTerm, matchedPaths]);

  return (
    <div 
      className={cn(
        "pl-5 border-l border-gray-200 dark:border-gray-800",
        isSearchMatched ? "bg-yellow-100 dark:bg-yellow-900/20" : "",
        level === 0 ? "border-l-0 pl-0" : ""
      )}
    >
      <div 
        className="flex items-center py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded"
        onClick={handleToggle}
      >
        <div style={{ width: '20px' }} className="flex-shrink-0">
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )
          )}
        </div>
        
        <div className="font-medium text-sm">
          {propertyName && (
            <>
              <span className="text-blue-600 dark:text-blue-400">{propertyName}</span>
              <span className="text-gray-500 mx-1">:</span>
            </>
          )}
        </div>
        
        <div className="flex items-center">
          {isExpandable ? (
            <span 
              className={cn(
                "text-sm",
                dataType === 'array' ? "text-yellow-600 dark:text-yellow-400" : "text-gray-600 dark:text-gray-400"
              )}
            >
              {dataType === 'array' 
                ? `Array(${Object.keys(data).length})` 
                : `Object{${Object.keys(data).length}}`}
            </span>
          ) : (
            <span 
              className={cn(
                "text-sm",
                dataType === 'string' ? "text-green-600 dark:text-green-400" : 
                dataType === 'number' ? "text-purple-600 dark:text-purple-400" :
                dataType === 'boolean' ? "text-red-600 dark:text-red-400" : 
                "text-gray-600 dark:text-gray-400"
              )}
            >
              {formatValue(data)}
            </span>
          )}
        </div>
        
        {pathCopyEnabled && path.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={handleCopyPath}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy path</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {renderedChildren}
    </div>
  );
};

export function NestedJsonViewer({
  data,
  title,
  expandedByDefault = false,
  maxDepth = 20,
  searchEnabled = true,
  pathCopyEnabled = true,
  className,
  height = "500px",
}: NestedJsonViewerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Find path matches when searching
  const matchedPaths = useMemo(() => {
    if (!searchTerm) return new Set<string>();
    
    const matches = new Set<string>();
    
    const findMatches = (obj: any, currentPath: string[] = []) => {
      if (obj === null || obj === undefined) return;
      
      // Check if the current node matches the search term
      const nodeKey = currentPath.join(".");
      if (
        typeof obj === "string" &&
        obj.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        matches.add(nodeKey);
        // Add parent paths as well for context
        let parentPath = [...currentPath];
        while (parentPath.length > 0) {
          parentPath.pop();
          matches.add(parentPath.join("."));
        }
      }
      
      // For objects (including arrays), recursively search the children
      if (typeof obj === "object" && obj !== null) {
        Object.keys(obj).forEach(key => {
          if (key.toLowerCase().includes(searchTerm.toLowerCase())) {
            matches.add([...currentPath, key].join("."));
            // Add parent paths
            let parentPath = [...currentPath];
            while (parentPath.length > 0) {
              matches.add(parentPath.join("."));
              parentPath.pop();
            }
          }
          findMatches(obj[key], [...currentPath, key]);
        });
      }
    };
    
    findMatches(data);
    return matches;
  }, [data, searchTerm]);

  // Auto-expand matched nodes
  useEffect(() => {
    if (searchTerm && matchedPaths.size > 0) {
      setExpandedNodes(prev => new Set([...prev, ...matchedPaths]));
    }
  }, [matchedPaths, searchTerm]);

  const handleNodeToggle = useCallback((path: string[]) => {
    const nodeKey = getNodeKey(path);
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(nodeKey)) {
        newExpanded.delete(nodeKey);
      } else {
        newExpanded.add(nodeKey);
      }
      return newExpanded;
    });
  }, []);

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
    toast({
      title: "Path copied",
      description: `Copied: ${path}`,
    });
  }, [toast]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  const expandAll = useCallback(() => {
    const allPaths = new Set<string>();
    
    const collectPaths = (obj: any, currentPath: string[] = []) => {
      if (obj === null || obj === undefined) return;
      
      const nodeKey = currentPath.join(".");
      if (nodeKey) allPaths.add(nodeKey);
      
      if (typeof obj === "object" && obj !== null) {
        Object.keys(obj).forEach(key => {
          collectPaths(obj[key], [...currentPath, key]);
        });
      }
    };
    
    collectPaths(data);
    setExpandedNodes(allPaths);
  }, [data]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  return (
    <Card className={className}>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      
      <CardContent className="p-0">
        <div className="p-3 border-b flex flex-wrap items-center gap-2">
          <div className="flex items-center flex-grow gap-2">
            {searchEnabled && (
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search keys and values..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-8 h-8"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={clearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {searchTerm && matchedPaths.size > 0 && (
              <Badge variant="secondary">
                {matchedPaths.size} matches
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </div>
        
        <ScrollArea style={{ height }} className="p-4">
          {data ? (
            <JsonNode
              path={[]}
              data={data}
              level={0}
              isExpanded={expandedByDefault}
              onToggle={handleNodeToggle}
              maxDepth={maxDepth}
              searchTerm={searchTerm}
              matchedPaths={matchedPaths}
              onCopyPath={handleCopyPath}
              pathCopyEnabled={pathCopyEnabled}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No data available
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
