import React, { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Search, Copy, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NestedJsonViewerProps {
  data: any;
  expandedByDefault?: boolean;
  maxDepth?: number;
  searchEnabled?: boolean;
  pathCopyEnabled?: boolean;
}

interface JsonNodeProps {
  keyName: string | number | null;
  value: any;
  depth: number;
  expandedByDefault?: boolean;
  maxDepth?: number;
  searchQuery?: string;
  path?: (string | number)[];
  onCopyPath?: (path: (string | number)[]) => void;
  pathCopyEnabled?: boolean;
}

const JsonNode: React.FC<JsonNodeProps> = ({
  keyName,
  value,
  depth,
  expandedByDefault = false,
  maxDepth = 5,
  searchQuery = "",
  path = [],
  onCopyPath,
  pathCopyEnabled = false,
}) => {
  const [expanded, setExpanded] = useState(expandedByDefault);
  const [highlight, setHighlight] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentPath = keyName !== null ? [...path, keyName] : path;

  useEffect(() => {
    if (searchQuery && typeof value === 'string' && value.toLowerCase().includes(searchQuery.toLowerCase())) {
      setHighlight(true);
    } else if (searchQuery && keyName && typeof keyName === 'string' && keyName.toLowerCase().includes(searchQuery.toLowerCase())) {
      setHighlight(true);
    } else {
      setHighlight(false);
    }
  }, [searchQuery, value, keyName]);

  const handleCopyPath = useCallback(() => {
    if (onCopyPath) {
      onCopyPath(currentPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [onCopyPath, currentPath]);

  if (value === null) {
    return (
      <div className="pl-2">
        <span className="text-gray-500">
          {keyName !== null && (<>{keyName}: </>)}
          <span className="text-blue-500">null</span>
        </span>
      </div>
    );
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return (
      <div className="pl-2">
        <span className="text-gray-500">
          {keyName !== null && (<>{keyName}: </>)}
          {typeof value === 'string' && <span className={cn("text-green-500", highlight && "bg-yellow-200")}>"{value}"</span>}
          {typeof value === 'number' && <span className={cn("text-orange-500", highlight && "bg-yellow-200")}>{value}</span>}
          {typeof value === 'boolean' && <span className="text-purple-500">{value.toString()}</span>}
        </span>
        {pathCopyEnabled && onCopyPath && (
          <Button variant="ghost" size="icon" onClick={handleCopyPath} disabled={copied}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
      </div>
    );
  }

  if (Array.isArray(value) || typeof value === 'object') {
    const hasChildren = Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0;

    if (depth >= maxDepth) {
      return (
        <div className="pl-2">
          <span className="text-gray-500">
            {keyName !== null && (<>{keyName}: </>)}
            {Array.isArray(value) ? `Array[${value.length}]` : 'Object'}
          </span>
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center">
          {hasChildren ? (
            <button onClick={() => setExpanded(!expanded)} className="w-5 h-5 flex items-center justify-center">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <div className="w-5 h-5" />
          )}
          <span className="text-gray-500">
            {keyName !== null && (<>{keyName}: </>)}
            {Array.isArray(value) ? `Array[${value.length}]` : 'Object'}
          </span>
          {pathCopyEnabled && onCopyPath && (
            <Button variant="ghost" size="icon" onClick={handleCopyPath} disabled={copied}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
        </div>
        {expanded && (
          <div className="pl-2">
            {Array.isArray(value) ? (
              value.map((item, index) => (
                <JsonNode
                  key={index}
                  keyName={index}
                  value={item}
                  depth={depth + 1}
                  expandedByDefault={expandedByDefault}
                  maxDepth={maxDepth}
                  searchQuery={searchQuery}
                  path={currentPath}
                  onCopyPath={onCopyPath}
                  pathCopyEnabled={pathCopyEnabled}
                />
              ))
            ) : (
              Object.entries(value).map(([key, val]) => (
                <JsonNode
                  key={key}
                  keyName={key}
                  value={val}
                  depth={depth + 1}
                  expandedByDefault={expandedByDefault}
                  maxDepth={maxDepth}
                  searchQuery={searchQuery}
                  path={currentPath}
                  onCopyPath={onCopyPath}
                  pathCopyEnabled={pathCopyEnabled}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

const NestedJsonViewer: React.FC<NestedJsonViewerProps> = ({
  data,
  expandedByDefault = false,
  maxDepth = 5,
  searchEnabled = false,
  pathCopyEnabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedPath, setCopiedPath] = useState<(string | number)[] | null>(null);

  const handleCopyPath = useCallback((path: (string | number)[]) => {
    const pathString = path.map(segment => {
      const segmentStr = String(segment);
      return !isNaN(Number(segmentStr)) ? `[${segmentStr}]` : `.${segmentStr}`;
    }).join('').replace(/^\./, '');
    
    navigator.clipboard.writeText(pathString);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  }, []);

  return (
    <div className="w-full">
      {searchEnabled && (
        <div className="mb-2 flex items-center">
          <Search className="h-4 w-4 mr-2 text-gray-500" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>
      )}
      <ScrollArea className="rounded-md border p-2">
        {data && typeof data === 'object' ? (
          <JsonNode
            keyName={null}
            value={data}
            depth={0}
            expandedByDefault={expandedByDefault}
            maxDepth={maxDepth}
            searchQuery={searchQuery}
            path={[]}
            onCopyPath={pathCopyEnabled ? handleCopyPath : undefined}
            pathCopyEnabled={pathCopyEnabled}
          />
        ) : (
          <p className="text-red-500">Data must be a valid JSON object.</p>
        )}
      </ScrollArea>
      {copiedPath && (
        <div className="mt-2 text-sm text-green-500">
          Path copied to clipboard: {copiedPath.join('.')}
        </div>
      )}
    </div>
  );
};

export default NestedJsonViewer;
