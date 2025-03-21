
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ShopifyTestRunner from '../components/shopify/testing/ShopifyTestSuite';
import TestingStrategyDocument from '../components/shopify/testing/TestingStrategyDocument';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Clipboard, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ShopifyTestingPlan: React.FC = () => {
  const [activeTab, setActiveTab] = useState('strategy');
  const [copied, setCopied] = useState(false);
  
  // Function to copy test environment settings
  const copyTestConfig = () => {
    const config = {
      testEnvironmentUrl: `${window.location.origin}/api/shopify-test-environment`,
      defaultScenarios: [
        "success", "rate_limit_exceeded", "network_error", 
        "partial_success", "data_error", "timeout", "schema_change"
      ],
      exampleUsage: `
// Example usage in your test code:
const response = await fetch('${window.location.origin}/api/shopify-test-environment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scenario: 'rate_limit_exceeded',  // The test scenario to simulate
    errorRate: 0.25,                   // 25% chance of random errors
    rateLimitRemaining: 100,           // Remaining API calls
    rateLimitMax: 1000,                // Maximum API calls
    latencyMs: 500,                    // Add 500ms latency
    query: 'your GraphQL query here',  // Optional query for data generation
    variables: {}                       // Optional variables for the query
  })
});
`
    };
    
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Shopify Testing & Integration Plan</h1>
          <p className="text-muted-foreground">
            Comprehensive testing infrastructure for production Shopify integrations
          </p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="strategy">Testing Strategy</TabsTrigger>
          <TabsTrigger value="runner">Test Runner</TabsTrigger>
          <TabsTrigger value="environment">Test Environment</TabsTrigger>
        </TabsList>
        
        <TabsContent value="strategy" className="space-y-4">
          <TestingStrategyDocument />
        </TabsContent>
        
        <TabsContent value="runner" className="space-y-4">
          <ShopifyTestRunner />
        </TabsContent>
        
        <TabsContent value="environment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shopify Test Environment</CardTitle>
              <CardDescription>
                A controlled environment for testing Shopify API integration with simulated conditions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Environment Overview</h3>
                <p className="text-muted-foreground">
                  The Shopify Test Environment provides a controlled way to test your integration against various scenarios, 
                  including error conditions, rate limiting, network issues, and schema changes. It allows you to verify
                  your system's resilience and error handling without affecting real Shopify stores.
                </p>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-lg font-medium mb-2">Supported Test Scenarios</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <h4 className="font-medium mb-1">Success</h4>
                      <p className="text-sm text-muted-foreground">
                        Simulates successful API responses with normal data
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <h4 className="font-medium mb-1">Rate Limiting</h4>
                      <p className="text-sm text-muted-foreground">
                        Simulates rate limit exceeded responses with Retry-After headers
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <h4 className="font-medium mb-1">Network Errors</h4>
                      <p className="text-sm text-muted-foreground">
                        Simulates network timeouts and connection failures
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <h4 className="font-medium mb-1">Partial Success</h4>
                      <p className="text-sm text-muted-foreground">
                        Returns data with warnings and partial failures
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <h4 className="font-medium mb-1">Data Errors</h4>
                      <p className="text-sm text-muted-foreground">
                        Returns GraphQL errors with detailed error information
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <h4 className="font-medium mb-1">Schema Changes</h4>
                      <p className="text-sm text-muted-foreground">
                        Simulates API schema changes to test adaptation
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium">Configuration Reference</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyTestConfig}
                    className="flex items-center gap-1"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Clipboard className="h-4 w-4" />
                        Copy Config
                      </>
                    )}
                  </Button>
                </div>
                <div className="rounded-md bg-black/10 p-4 overflow-auto">
                  <pre className="text-sm">
                    {`// Example usage
const response = await fetch('/api/shopify-test-environment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scenario: 'rate_limit_exceeded',  // Test scenario to simulate
    errorRate: 0.25,                  // 25% chance of random errors
    rateLimitRemaining: 100,          // Remaining API calls
    rateLimitMax: 1000,               // Maximum API calls
    latencyMs: 500,                   // Add 500ms latency
    query: 'your GraphQL query',      // Optional for data generation
    variables: {}                     // Optional variables
  })
});`}
                  </pre>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-lg font-medium mb-2">Integration Testing Guidelines</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Configure your application to use the test environment URL instead of the real Shopify API</li>
                  <li>Create test scripts for each error condition and expected recovery behavior</li>
                  <li>Validate that your system properly handles all error scenarios and rate limiting</li>
                  <li>Test with various latency values to ensure timeout handling works correctly</li>
                  <li>Verify schema change adaptation by testing with the schema_change scenario</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShopifyTestingPlan;
