
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShopifyDataTable } from "./ShopifyDataTable";
import { NestedJsonViewer } from "./NestedJsonViewer";
import { LargeDatasetViewer } from "./LargeDatasetViewer";
import { createShopifyClient } from "@/utils/shopify/shopifyClient";
import { optimizeGraphQLQuery, estimateQueryComplexity } from "@/utils/shopify/queryOptimizer";
import { AlertCircle, Info } from "lucide-react";

interface ShopifyComponentsProps {
  sourceId: string;
}

export default function ShopifyComponents({ sourceId }: ShopifyComponentsProps) {
  const [activeTab, setActiveTab] = useState("datatable");
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sample columns configuration for the data table
  const columns = [
    {
      id: "id",
      header: "ID",
      accessorKey: "id",
    },
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
    },
    {
      id: "vendor",
      header: "Vendor",
      accessorKey: "vendor",
    },
    {
      id: "productType",
      header: "Product Type",
      accessorKey: "productType",
    },
    {
      id: "createdAt",
      header: "Created At",
      accessorKey: "createdAt",
    },
  ];
  
  // Load sample data when the component mounts
  useEffect(() => {
    const loadSampleData = async () => {
      if (!sourceId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const client = createShopifyClient(sourceId);
        
        // Sample optimized query
        const query = optimizeGraphQLQuery(`
          query getProducts($first: Int!) {
            products(first: $first) {
              edges {
                node {
                  id
                  title
                  handle
                  status
                  productType
                  vendor
                  createdAt
                  updatedAt
                  tags
                  totalInventory
                  priceRangeV2 {
                    minVariantPrice {
                      amount
                      currencyCode
                    }
                    maxVariantPrice {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        `);
        
        // Calculate query complexity
        const complexity = estimateQueryComplexity(query);
        console.log("Query complexity:", complexity);
        
        const result = await client.query(query, { first: 20 });
        
        if (result.data && result.data.products && result.data.products.edges) {
          // Transform the data for easier consumption
          const products = result.data.products.edges.map((edge: any) => {
            const node = edge.node;
            return {
              id: node.id.replace("gid://shopify/Product/", ""),
              title: node.title,
              handle: node.handle,
              status: node.status,
              productType: node.productType,
              vendor: node.vendor,
              createdAt: new Date(node.createdAt).toLocaleString(),
              updatedAt: new Date(node.updatedAt).toLocaleString(),
              tags: node.tags,
              totalInventory: node.totalInventory,
              minPrice: node.priceRangeV2?.minVariantPrice?.amount,
              maxPrice: node.priceRangeV2?.maxVariantPrice?.amount,
              currencyCode: node.priceRangeV2?.minVariantPrice?.currencyCode,
            };
          });
          
          setSampleData(products);
        }
      } catch (err) {
        console.error("Error loading sample data:", err);
        setError(err instanceof Error ? err.message : "Failed to load sample data");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSampleData();
  }, [sourceId]);
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Shopify Data Components</CardTitle>
        <CardDescription>
          Production-ready components for working with Shopify data
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="datatable">Data Table</TabsTrigger>
            <TabsTrigger value="jsonviewer">JSON Viewer</TabsTrigger>
            <TabsTrigger value="largedata">Large Dataset Viewer</TabsTrigger>
          </TabsList>
          
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Demo Components</AlertTitle>
            <AlertDescription>
              These components are demo implementations. The real data is loaded from your Shopify store if connected.
            </AlertDescription>
          </Alert>
          
          <TabsContent value="datatable">
            <ShopifyDataTable
              title="Shopify Products"
              description="Sample product data with pagination and filtering"
              data={sampleData}
              columns={columns}
              loading={isLoading}
              error={error || undefined}
              pagination={{
                pageSize: 10,
                pageIndex: 0,
                onPageChange: () => {},
                onPageSizeChange: () => {},
              }}
              onRowClick={(row) => console.log("Row clicked:", row)}
            />
          </TabsContent>
          
          <TabsContent value="jsonviewer">
            <NestedJsonViewer
              title="Nested JSON Viewer"
              data={sampleData}
              expandedByDefault={false}
              searchEnabled={true}
              pathCopyEnabled={true}
              height="600px"
            />
          </TabsContent>
          
          <TabsContent value="largedata">
            <LargeDatasetViewer
              title="Large Dataset Viewer"
              data={sampleData}
              columns={columns}
              loading={isLoading}
              error={error}
              height="600px"
              onRowClick={(row) => console.log("Row details:", row)}
              onDownload={() => {
                const dataStr = JSON.stringify(sampleData, null, 2);
                const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
                const exportName = 'shopify-data-export.json';
                
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportName);
                linkElement.click();
              }}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
