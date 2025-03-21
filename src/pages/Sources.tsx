
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SourceList from '@/components/sources/SourceList';
import ConnectionLogView from '@/components/sources/ConnectionLogView';
import ConnectionMonitoringDashboard from '@/components/sources/ConnectionMonitoringDashboard';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Plus } from 'lucide-react';

const Sources = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('sources');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Extract source ID from query params if present
  useEffect(() => {
    const sourceId = searchParams.get('sourceId');
    const tab = searchParams.get('tab');
    
    if (sourceId) {
      setSelectedSourceId(sourceId);
    }
    
    if (tab && ['sources', 'activity', 'monitoring'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  
  // Update URL when tabs change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', value);
    
    // Only include sourceId if we're in monitoring tab
    if (value === 'monitoring') {
      if (selectedSourceId) {
        newParams.set('sourceId', selectedSourceId);
      }
    } else {
      newParams.delete('sourceId');
    }
    
    setSearchParams(newParams);
  };
  
  // Handle source selection for monitoring
  const handleSourceSelect = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sourceId', sourceId);
    newParams.set('tab', 'monitoring');
    setSearchParams(newParams);
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sources</h1>
          <p className="text-muted-foreground">
            Manage your data sources and connections.
          </p>
        </div>
        <Button onClick={() => navigate('/sources/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Source
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList>
          <TabsTrigger value="sources">Shopify Sources</TabsTrigger>
          <TabsTrigger value="activity">Connection Activity</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring Dashboard</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sources" className="mt-4">
          <SourceList />
        </TabsContent>
        
        <TabsContent value="activity" className="mt-4">
          <ConnectionLogView />
        </TabsContent>
        
        <TabsContent value="monitoring" className="mt-4">
          {selectedSourceId ? (
            <ConnectionMonitoringDashboard sourceId={selectedSourceId} />
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No Source Selected</h3>
                <p className="mt-2 text-muted-foreground">
                  Please select a source to view its monitoring dashboard.
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => handleTabChange('sources')}
                >
                  View Sources
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Sources;
