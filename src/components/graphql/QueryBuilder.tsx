
import { Dialog } from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import SchemaExplorer from "./SchemaExplorer";
import SaveTemplateDialog from "./SaveTemplateDialog";
import QueryBuilderTabs from "./QueryBuilderTabs";
import { QueryBuilderProvider, useQueryBuilder } from "./contexts/QueryBuilderContext";

interface QueryBuilderProps {
  sourceId: string;
}

// The main wrapper component
const QueryBuilder = ({ sourceId }: QueryBuilderProps) => {
  return (
    <QueryBuilderProvider sourceId={sourceId}>
      <QueryBuilderContent />
    </QueryBuilderProvider>
  );
};

// The internal content component that uses the context
const QueryBuilderContent = () => {
  const { 
    sourceId, 
    handleTypeSelect, 
    handleFieldSelect, 
    selectedFields,
    saveDialogOpen,
    setSaveDialogOpen,
    saveTemplate
  } = useQueryBuilder();

  return (
    <div className="h-full">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle>Shopify GraphQL Query Builder</CardTitle>
        </CardHeader>
        
        <CardContent className="h-[calc(100%-8rem)]">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={30} minSize={20}>
              <div className="h-full overflow-hidden">
                <Label className="mb-2 block">Schema Explorer</Label>
                <SchemaExplorer 
                  sourceId={sourceId}
                  onTypeSelect={handleTypeSelect}
                  onFieldSelect={handleFieldSelect}
                  selectedFields={selectedFields}
                />
              </div>
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={70}>
              <QueryBuilderTabs />
            </ResizablePanel>
          </ResizablePanelGroup>
        </CardContent>
      </Card>
      
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <SaveTemplateDialog 
          onSave={saveTemplate}
          onCancel={() => setSaveDialogOpen(false)}
        />
      </Dialog>
    </div>
  );
};

// Forgot to import Label
import { Label } from "@/components/ui/label";

export default QueryBuilder;
