
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SourceList from '@/components/sources/SourceList';
import ConnectionLogView from '@/components/sources/ConnectionLogView';

const Sources = () => {
  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Sources</h1>
      <p className="text-muted-foreground">
        Manage your data sources and connections.
      </p>

      <Tabs defaultValue="sources" className="mt-6">
        <TabsList>
          <TabsTrigger value="sources">Shopify Sources</TabsTrigger>
          <TabsTrigger value="activity">Connection Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sources" className="mt-4">
          <SourceList />
        </TabsContent>
        
        <TabsContent value="activity" className="mt-4">
          <ConnectionLogView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Sources;
