
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import QueryBuilderHeader from "./QueryBuilderHeader";
import QueryBuilderFields from "./QueryBuilderFields";
import QueryEditor from "./QueryEditor";
import QueryVariables from "./QueryVariables";
import QueryTemplates from "./QueryTemplates";
import QueryResults from "./QueryResults";
import { useQueryBuilder } from "./contexts/QueryBuilderContext";

const QueryBuilderTabs = () => {
  const { 
    activeTab, 
    setActiveTab,
    generatedQuery, 
    isExecuting, 
    complexity, 
    executeQuery, 
    copyToClipboard, 
    setSaveDialogOpen,
    queryVariables,
    handleVariableChange,
    templates,
    loadTemplate,
    queryResult,
    executionTime,
    errorMessage
  } = useQueryBuilder();

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="builder">Field Selection</TabsTrigger>
        <TabsTrigger value="query">GraphQL Query</TabsTrigger>
        <TabsTrigger value="variables">Variables</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
      </TabsList>
      
      <TabsContent value="builder" className="h-[calc(100vh-18rem)] overflow-auto">
        <div className="space-y-4">
          <QueryBuilderHeader />
          <QueryBuilderFields />
        </div>
      </TabsContent>
      
      <TabsContent value="query">
        <QueryEditor 
          generatedQuery={generatedQuery}
          isExecuting={isExecuting}
          complexity={complexity}
          onExecute={executeQuery}
          onCopy={copyToClipboard}
          onSave={() => setSaveDialogOpen(true)}
        />
      </TabsContent>
      
      <TabsContent value="variables">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Query Variables</CardTitle>
            </CardHeader>
            <CardContent>
              <QueryVariables 
                variables={queryVariables}
                onVariableChange={handleVariableChange}
              />
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      
      <TabsContent value="templates">
        <div className="space-y-4">
          <QueryTemplates 
            templates={templates}
            onLoadTemplate={loadTemplate}
          />
        </div>
      </TabsContent>
      
      <TabsContent value="results">
        <div className="space-y-4">
          <QueryResults 
            isExecuting={isExecuting}
            errorMessage={errorMessage}
            queryResult={queryResult}
            executionTime={executionTime}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default QueryBuilderTabs;
