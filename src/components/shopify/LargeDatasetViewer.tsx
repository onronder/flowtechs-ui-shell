
import React, { useState } from 'react';
import { Table, FileJson } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import ShopifyDataTable from "./ShopifyDataTable";
import NestedJsonViewer from "./NestedJsonViewer";

export default function LargeDatasetViewer({ data, columns }) {
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');

  return (
    <Card>
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'json')}>
        <div className="flex justify-end p-4">
          <TabsList>
            <TabsTrigger value="table">
              <Table className="h-4 w-4 mr-2" />
              Table
            </TabsTrigger>
            <TabsTrigger value="json">
              <FileJson className="h-4 w-4 mr-2" />
              JSON
            </TabsTrigger>
          </TabsList>
        </div>
        
        <CardContent>
          <TabsContent value="table" className="mt-0">
            <ShopifyDataTable 
              data={data}
              columns={columns}
            />
          </TabsContent>
          
          <TabsContent value="json" className="mt-0">
            <NestedJsonViewer data={data} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
