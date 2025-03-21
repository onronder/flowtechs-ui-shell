
import { Copy, Save, PlayCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QueryEditorProps {
  generatedQuery: string;
  isExecuting: boolean;
  complexity: number;
  onExecute: () => void;
  onCopy: (text: string) => void;
  onSave: () => void;
  onDownload?: () => void;
}

const QueryEditor = ({ 
  generatedQuery, 
  isExecuting,
  complexity,
  onExecute, 
  onCopy, 
  onSave,
  onDownload 
}: QueryEditorProps) => {
  const getComplexityColor = () => {
    if (complexity < 10) return "text-green-500";
    if (complexity < 20) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onCopy(generatedQuery)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy query to clipboard</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onSave}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save as Template
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save query as a reusable template</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {onDownload && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={onDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export query as a text file</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm">
            Complexity: 
            <span className={`ml-1 font-medium ${getComplexityColor()}`}>
              {complexity}
            </span>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={onExecute}
                  disabled={isExecuting || !generatedQuery}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Execute Query
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Run this query against the Shopify API</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <pre className="font-mono text-sm p-4 overflow-x-auto whitespace-pre">
              {generatedQuery}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default QueryEditor;
