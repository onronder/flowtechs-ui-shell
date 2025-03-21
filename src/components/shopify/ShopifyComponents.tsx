
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlayCircle, FileJson, Table } from 'lucide-react';
import ShopifyDataTable from "./ShopifyDataTable";
import NestedJsonViewer from "./NestedJsonViewer";

export const ShopifyStoreQuery = ({ client, query, variables = {}, columns }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('table');

  const executeQuery = async () => {
    try {
      setLoading(true);
      setError(null);
      const sourceId = client.getSourceId();
      const response = await client.executeQuery(query, variables);
      setData(response);
    } catch (err) {
      console.error('Error executing query:', err);
      setError(err.message || 'An error occurred executing the query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Store Query</CardTitle>
          <Button onClick={executeQuery} disabled={loading}>
            <PlayCircle className="mr-2 h-4 w-4" />
            {loading ? 'Executing...' : 'Execute Query'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-red-500 mb-4 p-3 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        {data ? (
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className="mb-4">
              <TabsTrigger value="table">
                <Table className="mr-2 h-4 w-4" />
                Table View
              </TabsTrigger>
              <TabsTrigger value="json">
                <FileJson className="mr-2 h-4 w-4" />
                JSON View
              </TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <ShopifyDataTable data={data} columns={columns} />
            </TabsContent>
            <TabsContent value="json">
              <NestedJsonViewer data={data} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            {loading ? 'Loading...' : 'Execute the query to see results'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const ShopifyQueryPreview = ({ query, variables }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Query Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <pre className="text-xs font-mono bg-muted p-4 rounded-md">
            {query}
          </pre>
          
          {Object.keys(variables).length > 0 && (
            <>
              <div className="my-2 font-semibold">Variables:</div>
              <pre className="text-xs font-mono bg-muted p-4 rounded-md">
                {JSON.stringify(variables, null, 2)}
              </pre>
            </>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
