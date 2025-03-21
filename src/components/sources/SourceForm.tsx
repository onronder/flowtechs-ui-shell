
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Key, RefreshCw, ShieldCheck } from 'lucide-react';
import { Form } from '@/components/ui/form';
import SourceCredentialsTab from './form/SourceCredentialsTab';
import SourceAdvancedTab from './form/SourceAdvancedTab';
import ConnectionStatusDisplay from './form/ConnectionStatusDisplay';
import ConnectionErrorAlert from './ConnectionErrorAlert';
import { useSourceFormLogic } from './form/useSourceFormLogic';

export default function SourceForm() {
  const {
    form,
    loading,
    testingConnection,
    connectionStatus,
    connectionMessage,
    rateLimitInfo,
    isEditing,
    navigate,
    testConnection,
    onSubmit,
    connectionError,
    isSupabaseConfigured
  } = useSourceFormLogic();

  return (
    <div className="space-y-6">
      {connectionError && (
        <ConnectionErrorAlert 
          error={connectionError} 
          supabaseConfigured={isSupabaseConfigured} 
        />
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Shopify Source' : 'Add New Shopify Source'}</CardTitle>
          <CardDescription>
            Connect to a Shopify store to import data for analysis and processing.
          </CardDescription>
        </CardHeader>
        
        <Tabs defaultValue="credentials" className="px-6">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="credentials">
              <Key className="mr-2 h-4 w-4" />
              Credentials
            </TabsTrigger>
            <TabsTrigger value="advanced">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Advanced Settings
            </TabsTrigger>
          </TabsList>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <TabsContent value="credentials">
                <CardContent className="space-y-6 p-0">
                  <SourceCredentialsTab form={form} />
                </CardContent>
              </TabsContent>
              
              <TabsContent value="advanced">
                <CardContent className="space-y-6 p-0">
                  <SourceAdvancedTab form={form} />
                </CardContent>
              </TabsContent>

              <CardFooter className="flex justify-between border-t pt-6 mt-6">
                <ConnectionStatusDisplay 
                  connectionStatus={connectionStatus}
                  connectionMessage={connectionMessage}
                  rateLimitInfo={rateLimitInfo}
                />
                
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    disabled={testingConnection || loading || !isSupabaseConfigured}
                    onClick={() => testConnection(form.getValues())}
                  >
                    {testingConnection && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Test Connection
                  </Button>
                  
                  <Button 
                    type="submit" 
                    disabled={loading || testingConnection || !isSupabaseConfigured}
                  >
                    {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditing ? 'Update Source' : 'Save Source'}
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Form>
        </Tabs>
      </Card>
    </div>
  );
};
