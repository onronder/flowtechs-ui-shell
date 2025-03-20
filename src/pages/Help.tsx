
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, ExternalLink, Info, ShoppingBag } from "lucide-react";

const Help = () => {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground">
          Get help with using FlowTechs and learn about our features.
        </p>
      </div>

      <Tabs defaultValue="guides">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="guides">Quick Start Guides</TabsTrigger>
          <TabsTrigger value="integrations">Integration Help</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>
        
        <TabsContent value="guides" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Setting Up Shopify Integration
              </CardTitle>
              <CardDescription>
                Follow these steps to set up your first Shopify data integration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2">
                <li className="text-sm">
                  <span className="font-medium">Create a Shopify App:</span> Go to your Shopify Partner account and create a new app.
                </li>
                <li className="text-sm">
                  <span className="font-medium">Configure API Access:</span> Set up the required OAuth scopes for your integration.
                </li>
                <li className="text-sm">
                  <span className="font-medium">Get API Credentials:</span> Copy your API Key and Secret.
                </li>
                <li className="text-sm">
                  <span className="font-medium">Add Your Source:</span> In FlowTechs, go to Sources and add a new Shopify connection.
                </li>
                <li className="text-sm">
                  <span className="font-medium">Create a Dataset:</span> Configure your first dataset to extract Shopify data.
                </li>
              </ol>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  Make sure your Shopify app has the appropriate permissions for the data you want to access.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Common Data Extraction Patterns</CardTitle>
              <CardDescription>
                Learn about the most useful data extraction patterns for e-commerce.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>Product Data Extraction</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm mb-2">
                      Extract product data including variants, images, and inventory levels.
                    </p>
                    <pre className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-xs">
                      {`# Example GraphQL Query
{
  products(first: 50) {
    edges {
      node {
        id
        title
        variants {
          edges {
            node {
              id
              price
              inventoryQuantity
            }
          }
        }
      }
    }
  }
}`}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-2">
                  <AccordionTrigger>Order History Analysis</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm mb-2">
                      Extract order data for sales analysis and customer insights.
                    </p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        <span className="text-sm">Regular extraction of new orders</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        <span className="text-sm">Filter by date ranges</span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        <span className="text-sm">Include line items and fulfillment data</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-3">
                  <AccordionTrigger>Customer Data Integration</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm">
                      Extract customer data for CRM integration and marketing analytics, while ensuring GDPR compliance.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Shopify Integration</CardTitle>
              <CardDescription>
                Learn about connecting to the Shopify API and handling authentication.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                FlowTechs securely connects to your Shopify store using OAuth. Your access tokens are encrypted at rest and only decrypted when needed for data extraction.
              </p>
              
              <h3 className="text-sm font-medium mt-4">API Rate Limits</h3>
              <p className="text-sm">
                Shopify enforces rate limits on API requests. FlowTechs automatically manages these limits to ensure your integration remains functional.
              </p>
              
              <div className="flex items-center mt-4">
                <a 
                  href="https://shopify.dev/docs/admin-api/rest/reference" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 flex items-center"
                >
                  Shopify API Documentation
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>API Schema Caching</CardTitle>
              <CardDescription>
                Understand how FlowTechs optimizes API access with schema caching.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                FlowTechs caches the GraphQL schema from your Shopify store to optimize performance and reduce API calls. The schema is automatically refreshed when necessary.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="faq" className="space-y-4 mt-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="faq-1">
              <AccordionTrigger>How secure is my store data?</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm">
                  Your Shopify access tokens are encrypted at rest using strong encryption. Row Level Security (RLS) ensures that your data is only accessible to your account. We never store your Shopify admin password.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="faq-2">
              <AccordionTrigger>Can I schedule recurring data extractions?</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm">
                  Yes, you can configure datasets to refresh on a schedule. FlowTechs supports cron-style scheduling, allowing you to set up hourly, daily, weekly, or custom schedules for your data extractions.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="faq-3">
              <AccordionTrigger>What happens if my Shopify API credentials change?</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm">
                  If your API credentials change, you'll need to update them in the Sources page. FlowTechs will attempt to reconnect with the new credentials. Failed connection attempts are logged and visible in the interface.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="faq-4">
              <AccordionTrigger>How do I handle API rate limits?</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm">
                  FlowTechs automatically respects Shopify's rate limits and will pause and retry requests if limits are reached. For large data extractions, we recommend using scheduled jobs during off-peak hours.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Help;
