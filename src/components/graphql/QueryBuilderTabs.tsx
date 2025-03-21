
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQueryBuilder } from "./contexts/QueryBuilderContext";
import QueryEditor from "./QueryEditor";
import QueryVariables from "./QueryVariables";
import QueryResults from "./QueryResults";
import QueryTemplates from "./QueryTemplates";
import QueryBuilderFields from "./QueryBuilderFields";
import QueryBuilderHeader from "./QueryBuilderHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QueryBuilderTabs = () => {
  const { 
    activeTab, 
    setActiveTab,
    copyToClipboard,
    generatedQuery,
    executeQuery,
    isExecuting,
    saveDialogOpen,
    setSaveDialogOpen,
    queryResult
  } = useQueryBuilder();

  const [localTab, setLocalTab] = useState(activeTab);

  const handleTabChange = (value: string) => {
    setLocalTab(value);
    setActiveTab(value);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <QueryBuilderHeader />
      </div>

      <Tabs
        value={localTab}
        onValueChange={handleTabChange}
        className="flex-1 flex flex-col"
      >
        <div className="flex justify-between items-center mb-2">
          <TabsList>
            <TabsTrigger value="builder">Field Builder</TabsTrigger>
            <TabsTrigger value="query">Generated Query</TabsTrigger>
            <TabsTrigger value="variables">Variables</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(generatedQuery)}
            >
              Copy Query
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
            >
              Save As Template
            </Button>
            <Button
              size="sm"
              onClick={executeQuery}
              disabled={isExecuting}
            >
              Execute Query
            </Button>
          </div>
        </div>

        <TabsContent value="builder" className="flex-1 h-full">
          <QueryBuilderFields />
        </TabsContent>

        <TabsContent value="query" className="flex-1 h-full">
          <Card>
            <CardHeader>
              <CardTitle>Generated GraphQL Query</CardTitle>
            </CardHeader>
            <CardContent>
              <QueryEditor />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variables" className="flex-1 h-full">
          <QueryVariables />
        </TabsContent>

        <TabsContent value="results" className="flex-1 h-full">
          <QueryResults />
        </TabsContent>

        <TabsContent value="templates" className="flex-1 h-full">
          <QueryTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QueryBuilderTabs;
