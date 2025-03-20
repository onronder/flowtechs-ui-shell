
import { Copy, Save, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface QueryEditorProps {
  generatedQuery: string;
  isExecuting: boolean;
  onExecute: () => void;
  onCopy: (text: string) => void;
  onSave: () => void;
}

const QueryEditor = ({ 
  generatedQuery, 
  isExecuting,
  onExecute, 
  onCopy, 
  onSave 
}: QueryEditorProps) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onCopy(generatedQuery)}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onSave}
          >
            <Save className="h-4 w-4 mr-2" />
            Save as Template
          </Button>
        </div>
        <Button 
          onClick={onExecute}
          disabled={isExecuting || !generatedQuery}
        >
          <PlayCircle className="h-4 w-4 mr-2" />
          Execute Query
        </Button>
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
