
import { supabase } from "@/integrations/supabase/client";
import {
  BatchProcessor,
  QueryContext,
  QueryEngineConfig,
  QueryError,
  DEFAULT_QUERY_CONFIG,
  extractAndDeduplicateIds,
  processBatchesWithConcurrency,
  createBatches,
  queryCache
} from "./shopifyDependentQuery";
import { extractIdFromGid, formatShopifyGid } from "@/integrations/supabase/client";

// Shopify GraphQL query executor
export const executeShopifyQuery = async (
  sourceId: string,
  query: string,
  variables: Record<string, any>
): Promise<any> => {
  try {
    const response = await supabase.functions.invoke("execute-shopify-query", {
      body: {
        sourceId,
        query,
        variables
      }
    });

    if (response.error) {
      throw new Error(`GraphQL query error: ${response.error.message}`);
    }

    return response.data;
  } catch (error) {
    console.error("Error executing Shopify query:", error);
    throw error;
  }
};

// Product variant processor
export const productVariantProcessor: BatchProcessor<string, any> = {
  process: async (productIds: string[], batchIndex: number, context: QueryContext) => {
    const startTime = Date.now();
    
    // Deduplicate based on already processed IDs
    const uniqueIds = productIds.filter(id => !context.processedIds.has(id));
    if (uniqueIds.length === 0) return [];
    
    // Add to processed IDs
    uniqueIds.forEach(id => context.processedIds.add(id));
    
    // Format IDs as Shopify GIDs if they aren't already
    const formattedIds = uniqueIds.map(id => 
      id.includes('gid://') ? id : formatShopifyGid('Product', id)
    );
    
    // Build GraphQL query
    const query = `
      query getProductVariants($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            variants(first: 250) {
              edges {
                node {
                  id
                  title
                  sku
                  price
                  compareAtPrice
                  position
                  inventoryPolicy
                  inventoryQuantity
                  selectedOptions {
                    name
                    value
                  }
                  inventoryItem {
                    id
                    tracked
                    inventoryLevels(first: 10) {
                      edges {
                        node {
                          id
                          available
                          location {
                            id
                            name
                          }
                        }
                      }
                    }
                  }
                  metafields(first: 20) {
                    edges {
                      node {
                        id
                        namespace
                        key
                        value
                        type
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    try {
      const sourceId = context.metadata?.sourceId;
      if (!sourceId) {
        throw new Error("Source ID is required for Shopify queries");
      }
      
      const result = await executeShopifyQuery(sourceId, query, { ids: formattedIds });
      
      context.apiCalls++;
      context.totalResponseTime += Date.now() - startTime;
      
      // Extract variants with proper transformations
      const products = result.nodes.filter(Boolean);
      const allVariants: any[] = [];
      
      products.forEach(product => {
        const productId = extractIdFromGid(product.id);
        const variants = product.variants?.edges?.map(edge => {
          const variant = edge.node;
          const variantId = extractIdFromGid(variant.id);
          
          // Transform inventory levels
          const inventoryLevels = variant.inventoryItem?.inventoryLevels?.edges?.map(edge => {
            const level = edge.node;
            return {
              id: extractIdFromGid(level.id),
              available: level.available,
              location: {
                id: extractIdFromGid(level.location.id),
                name: level.location.name
              }
            };
          }) || [];
          
          // Transform metafields
          const metafields = variant.metafields?.edges?.map(edge => {
            const metafield = edge.node;
            return {
              id: extractIdFromGid(metafield.id),
              namespace: metafield.namespace,
              key: metafield.key,
              value: metafield.value,
              type: metafield.type
            };
          }) || [];
          
          return {
            id: variantId,
            productId,
            title: variant.title,
            sku: variant.sku,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            position: variant.position,
            inventoryPolicy: variant.inventoryPolicy,
            inventoryQuantity: variant.inventoryQuantity,
            selectedOptions: variant.selectedOptions,
            inventoryTracked: variant.inventoryItem?.tracked,
            inventoryLevels,
            metafields,
            product: {
              id: productId,
              title: product.title
            }
          };
        }) || [];
        
        allVariants.push(...variants);
      });
      
      return allVariants;
    } catch (error) {
      const queryError: QueryError = {
        phase: 'variant_processing',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        retryable: true,
        context: { batchIndex, productIds }
      };
      context.errors.push(queryError);
      console.error("Error processing product variants:", error);
      return [];
    }
  },
  getItemId: (id: string) => id,
  maxBatchSize: 50
};

// Order line items processor
export const orderLineItemsProcessor: BatchProcessor<string, any> = {
  process: async (orderIds: string[], batchIndex: number, context: QueryContext) => {
    const startTime = Date.now();
    
    // Deduplicate based on already processed IDs
    const uniqueIds = orderIds.filter(id => !context.processedIds.has(id));
    if (uniqueIds.length === 0) return [];
    
    // Add to processed IDs
    uniqueIds.forEach(id => context.processedIds.add(id));
    
    // Format IDs as Shopify GIDs if they aren't already
    const formattedIds = uniqueIds.map(id => 
      id.includes('gid://') ? id : formatShopifyGid('Order', id)
    );
    
    // Build GraphQL query
    const query = `
      query getOrderLineItems($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Order {
            id
            name
            lineItems(first: 250) {
              edges {
                node {
                  id
                  title
                  quantity
                  originalUnitPrice {
                    amount
                    currencyCode
                  }
                  discountedUnitPrice {
                    amount
                    currencyCode
                  }
                  totalDiscount {
                    amount
                    currencyCode
                  }
                  variant {
                    id
                    title
                    sku
                    product {
                      id
                      title
                      handle
                    }
                  }
                  customAttributes {
                    key
                    value
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    try {
      const sourceId = context.metadata?.sourceId;
      if (!sourceId) {
        throw new Error("Source ID is required for Shopify queries");
      }
      
      const result = await executeShopifyQuery(sourceId, query, { ids: formattedIds });
      
      context.apiCalls++;
      context.totalResponseTime += Date.now() - startTime;
      
      // Extract line items with proper transformations
      const orders = result.nodes.filter(Boolean);
      const allLineItems: any[] = [];
      
      orders.forEach(order => {
        const orderId = extractIdFromGid(order.id);
        const lineItems = order.lineItems?.edges?.map(edge => {
          const lineItem = edge.node;
          const lineItemId = extractIdFromGid(lineItem.id);
          
          // Process variant and product info if available
          let variantId = null;
          let variantTitle = null;
          let variantSku = null;
          let productId = null;
          let productTitle = null;
          let productHandle = null;
          
          if (lineItem.variant) {
            variantId = extractIdFromGid(lineItem.variant.id);
            variantTitle = lineItem.variant.title;
            variantSku = lineItem.variant.sku;
            
            if (lineItem.variant.product) {
              productId = extractIdFromGid(lineItem.variant.product.id);
              productTitle = lineItem.variant.product.title;
              productHandle = lineItem.variant.product.handle;
            }
          }
          
          return {
            id: lineItemId,
            orderId,
            orderName: order.name,
            title: lineItem.title,
            quantity: lineItem.quantity,
            originalUnitPrice: lineItem.originalUnitPrice,
            discountedUnitPrice: lineItem.discountedUnitPrice,
            totalDiscount: lineItem.totalDiscount,
            customAttributes: lineItem.customAttributes,
            variant: {
              id: variantId,
              title: variantTitle,
              sku: variantSku
            },
            product: {
              id: productId,
              title: productTitle,
              handle: productHandle
            }
          };
        }) || [];
        
        allLineItems.push(...lineItems);
      });
      
      return allLineItems;
    } catch (error) {
      const queryError: QueryError = {
        phase: 'line_item_processing',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        retryable: true,
        context: { batchIndex, orderIds }
      };
      context.errors.push(queryError);
      console.error("Error processing order line items:", error);
      return [];
    }
  },
  getItemId: (id: string) => id,
  maxBatchSize: 25
};

// Metafields processor for any resource type
export const metafieldsProcessor: BatchProcessor<{id: string, type: string}, any> = {
  process: async (resources: {id: string, type: string}[], batchIndex: number, context: QueryContext) => {
    const startTime = Date.now();
    
    // Group by resource type
    const resourcesByType: Record<string, string[]> = {};
    resources.forEach(res => {
      if (!context.processedIds.has(`${res.type}_${res.id}`)) {
        resourcesByType[res.type] = resourcesByType[res.type] || [];
        resourcesByType[res.type].push(res.id);
        context.processedIds.add(`${res.type}_${res.id}`);
      }
    });
    
    // Process each resource type
    const allMetafields: any[] = [];
    
    for (const [type, ids] of Object.entries(resourcesByType)) {
      if (ids.length === 0) continue;
      
      // Format IDs as Shopify GIDs
      const formattedIds = ids.map(id => 
        id.includes('gid://') ? id : formatShopifyGid(type, id)
      );
      
      // Build GraphQL query
      const query = `
        query getResourceMetafields($ids: [ID!]!) {
          nodes(ids: $ids) {
            __typename
            id
            ... on Product {
              metafields(first: 50) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                    createdAt
                    updatedAt
                  }
                }
              }
            }
            ... on ProductVariant {
              metafields(first: 50) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                    createdAt
                    updatedAt
                  }
                }
              }
            }
            ... on Order {
              metafields(first: 50) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                    createdAt
                    updatedAt
                  }
                }
              }
            }
            ... on Customer {
              metafields(first: 50) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                    createdAt
                    updatedAt
                  }
                }
              }
            }
            ... on Collection {
              metafields(first: 50) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                    createdAt
                    updatedAt
                  }
                }
              }
            }
          }
        }
      `;
      
      try {
        const sourceId = context.metadata?.sourceId;
        if (!sourceId) {
          throw new Error("Source ID is required for Shopify queries");
        }
        
        const result = await executeShopifyQuery(sourceId, query, { ids: formattedIds });
        
        context.apiCalls++;
        context.totalResponseTime += Date.now() - startTime;
        
        // Process results
        const resources = result.nodes.filter(Boolean);
        
        resources.forEach(resource => {
          const resourceId = extractIdFromGid(resource.id);
          const resourceType = resource.__typename;
          
          const metafields = resource.metafields?.edges?.map(edge => {
            const metafield = edge.node;
            return {
              id: extractIdFromGid(metafield.id),
              resourceId,
              resourceType,
              namespace: metafield.namespace,
              key: metafield.key,
              value: metafield.value,
              type: metafield.type,
              createdAt: metafield.createdAt,
              updatedAt: metafield.updatedAt
            };
          }) || [];
          
          allMetafields.push(...metafields);
        });
      } catch (error) {
        const queryError: QueryError = {
          phase: 'metafields_processing',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          retryable: true,
          context: { batchIndex, type, resourceIds: ids }
        };
        context.errors.push(queryError);
        console.error(`Error processing metafields for ${type}:`, error);
      }
    }
    
    return allMetafields;
  },
  getItemId: (resource: {id: string, type: string}) => `${resource.type}_${resource.id}`,
  maxBatchSize: 25
};

// Inventory tracking processor
export const inventoryProcessor: BatchProcessor<string, any> = {
  process: async (inventoryItemIds: string[], batchIndex: number, context: QueryContext) => {
    const startTime = Date.now();
    
    // Deduplicate based on already processed IDs
    const uniqueIds = inventoryItemIds.filter(id => !context.processedIds.has(id));
    if (uniqueIds.length === 0) return [];
    
    // Add to processed IDs
    uniqueIds.forEach(id => context.processedIds.add(id));
    
    // Format IDs as Shopify GIDs if they aren't already
    const formattedIds = uniqueIds.map(id => 
      id.includes('gid://') ? id : formatShopifyGid('InventoryItem', id)
    );
    
    // Build GraphQL query
    const query = `
      query getInventoryItems($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on InventoryItem {
            id
            tracked
            variant {
              id
              displayName
              sku
              inventoryQuantity
              product {
                id
                title
              }
            }
            inventoryLevels(first: 50) {
              edges {
                node {
                  id
                  available
                  location {
                    id
                    name
                    isActive
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    try {
      const sourceId = context.metadata?.sourceId;
      if (!sourceId) {
        throw new Error("Source ID is required for Shopify queries");
      }
      
      const result = await executeShopifyQuery(sourceId, query, { ids: formattedIds });
      
      context.apiCalls++;
      context.totalResponseTime += Date.now() - startTime;
      
      // Extract inventory data with proper transformations
      const inventoryItems = result.nodes.filter(Boolean);
      const allInventory: any[] = [];
      
      inventoryItems.forEach(item => {
        const inventoryItemId = extractIdFromGid(item.id);
        
        // Process variant and product info
        let variantId = null;
        let variantDisplayName = null;
        let variantSku = null;
        let productId = null;
        let productTitle = null;
        
        if (item.variant) {
          variantId = extractIdFromGid(item.variant.id);
          variantDisplayName = item.variant.displayName;
          variantSku = item.variant.sku;
          
          if (item.variant.product) {
            productId = extractIdFromGid(item.variant.product.id);
            productTitle = item.variant.product.title;
          }
        }
        
        // Process inventory levels
        const inventoryLevels = item.inventoryLevels?.edges?.map(edge => {
          const level = edge.node;
          return {
            id: extractIdFromGid(level.id),
            inventoryItemId,
            available: level.available,
            location: {
              id: extractIdFromGid(level.location.id),
              name: level.location.name,
              isActive: level.location.isActive
            }
          };
        }) || [];
        
        // Track total inventory across all locations
        const totalInventory = inventoryLevels.reduce((sum, level) => sum + (level.available || 0), 0);
        
        const inventoryData = {
          id: inventoryItemId,
          tracked: item.tracked,
          totalInventory,
          variant: {
            id: variantId,
            displayName: variantDisplayName,
            sku: variantSku,
            inventoryQuantity: item.variant?.inventoryQuantity
          },
          product: {
            id: productId,
            title: productTitle
          },
          inventoryLevels
        };
        
        allInventory.push(inventoryData);
      });
      
      return allInventory;
    } catch (error) {
      const queryError: QueryError = {
        phase: 'inventory_processing',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        retryable: true,
        context: { batchIndex, inventoryItemIds }
      };
      context.errors.push(queryError);
      console.error("Error processing inventory items:", error);
      return [];
    }
  },
  getItemId: (id: string) => id,
  maxBatchSize: 50
};

// Customer order history processor
export const customerOrderHistoryProcessor: BatchProcessor<string, any> = {
  process: async (customerIds: string[], batchIndex: number, context: QueryContext) => {
    const startTime = Date.now();
    
    // Deduplicate based on already processed IDs
    const uniqueIds = customerIds.filter(id => !context.processedIds.has(id));
    if (uniqueIds.length === 0) return [];
    
    // Add to processed IDs
    uniqueIds.forEach(id => context.processedIds.add(id));
    
    // Format IDs as Shopify GIDs if they aren't already
    const formattedIds = uniqueIds.map(id => 
      id.includes('gid://') ? id : formatShopifyGid('Customer', id)
    );
    
    // Build GraphQL query
    const query = `
      query getCustomerOrders($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Customer {
            id
            email
            firstName
            lastName
            orders(first: 50) {
              edges {
                node {
                  id
                  name
                  createdAt
                  displayFinancialStatus
                  displayFulfillmentStatus
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  subtotalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  lineItems(first: 10) {
                    edges {
                      node {
                        id
                        title
                        quantity
                        variant {
                          id
                          title
                          sku
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    try {
      const sourceId = context.metadata?.sourceId;
      if (!sourceId) {
        throw new Error("Source ID is required for Shopify queries");
      }
      
      const result = await executeShopifyQuery(sourceId, query, { ids: formattedIds });
      
      context.apiCalls++;
      context.totalResponseTime += Date.now() - startTime;
      
      // Extract customer order history with transformations
      const customers = result.nodes.filter(Boolean);
      const customerOrderHistories: any[] = [];
      
      customers.forEach(customer => {
        const customerId = extractIdFromGid(customer.id);
        
        // Process orders
        const orders = customer.orders?.edges?.map(edge => {
          const order = edge.node;
          const orderId = extractIdFromGid(order.id);
          
          // Process line items
          const lineItems = order.lineItems?.edges?.map(edge => {
            const lineItem = edge.node;
            const lineItemId = extractIdFromGid(lineItem.id);
            
            return {
              id: lineItemId,
              title: lineItem.title,
              quantity: lineItem.quantity,
              variant: lineItem.variant ? {
                id: extractIdFromGid(lineItem.variant.id),
                title: lineItem.variant.title,
                sku: lineItem.variant.sku
              } : null
            };
          }) || [];
          
          return {
            id: orderId,
            name: order.name,
            createdAt: order.createdAt,
            displayFinancialStatus: order.displayFinancialStatus,
            displayFulfillmentStatus: order.displayFulfillmentStatus,
            totalPrice: order.totalPriceSet?.shopMoney,
            subtotalPrice: order.subtotalPriceSet?.shopMoney,
            lineItems: lineItems
          };
        }) || [];
        
        customerOrderHistories.push({
          customer: {
            id: customerId,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName
          },
          orders,
          orderCount: orders.length,
          totalSpent: orders.reduce((sum, order) => 
            sum + parseFloat(order.totalPrice?.amount || "0"), 0)
        });
      });
      
      return customerOrderHistories;
    } catch (error) {
      const queryError: QueryError = {
        phase: 'customer_orders_processing',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        retryable: true,
        context: { batchIndex, customerIds }
      };
      context.errors.push(queryError);
      console.error("Error processing customer order histories:", error);
      return [];
    }
  },
  getItemId: (id: string) => id,
  maxBatchSize: 10 // Lower batch size as each customer can have multiple orders
};

// High-level function to extract product variants with optimized batching
export const extractProductVariants = async (
  sourceId: string,
  productIds: string[],
  config: Partial<QueryEngineConfig> = {},
  onProgress?: (progress: any) => void
) => {
  // Merge default config with provided config
  const mergedConfig: QueryEngineConfig = { ...DEFAULT_QUERY_CONFIG, ...config };
  
  // Create batches of product IDs
  const batches = createBatches(productIds, mergedConfig.batchSize);
  
  // Process batches with the variant processor
  return processBatchesWithConcurrency(batches, productVariantProcessor, mergedConfig, onProgress);
};

// High-level function to extract order line items with optimized batching
export const extractOrderLineItems = async (
  sourceId: string,
  orderIds: string[],
  config: Partial<QueryEngineConfig> = {},
  onProgress?: (progress: any) => void
) => {
  // Merge default config with provided config
  const mergedConfig: QueryEngineConfig = { ...DEFAULT_QUERY_CONFIG, ...config };
  
  // Create batches of order IDs
  const batches = createBatches(orderIds, mergedConfig.batchSize);
  
  // Add source ID to context metadata for query execution
  const context = { metadata: { sourceId } };
  
  // Process batches with the line item processor
  return processBatchesWithConcurrency(batches, orderLineItemsProcessor, mergedConfig, onProgress);
};

// High-level function to extract metafields for any resource type
export const extractMetafields = async (
  sourceId: string,
  resources: {id: string, type: string}[],
  config: Partial<QueryEngineConfig> = {},
  onProgress?: (progress: any) => void
) => {
  // Merge default config with provided config
  const mergedConfig: QueryEngineConfig = { ...DEFAULT_QUERY_CONFIG, ...config };
  
  // Create batches of resources
  const batches = createBatches(resources, mergedConfig.batchSize);
  
  // Add source ID to context metadata for query execution
  const context = { metadata: { sourceId } };
  
  // Process batches with the metafields processor
  return processBatchesWithConcurrency(batches, metafieldsProcessor, mergedConfig, onProgress);
};

// High-level function to extract inventory data
export const extractInventory = async (
  sourceId: string,
  inventoryItemIds: string[],
  config: Partial<QueryEngineConfig> = {},
  onProgress?: (progress: any) => void
) => {
  // Merge default config with provided config
  const mergedConfig: QueryEngineConfig = { ...DEFAULT_QUERY_CONFIG, ...config };
  
  // Create batches of inventory item IDs
  const batches = createBatches(inventoryItemIds, mergedConfig.batchSize);
  
  // Add source ID to context metadata for query execution
  const context = { metadata: { sourceId } };
  
  // Process batches with the inventory processor
  return processBatchesWithConcurrency(batches, inventoryProcessor, mergedConfig, onProgress);
};

// High-level function to extract customer order history
export const extractCustomerOrderHistory = async (
  sourceId: string,
  customerIds: string[],
  config: Partial<QueryEngineConfig> = {},
  onProgress?: (progress: any) => void
) => {
  // Merge default config with provided config
  const mergedConfig: QueryEngineConfig = { ...DEFAULT_QUERY_CONFIG, ...config };
  
  // Create batches of customer IDs
  const batches = createBatches(customerIds, mergedConfig.batchSize);
  
  // Add source ID to context metadata for query execution
  const context = { metadata: { sourceId } };
  
  // Process batches with the customer order history processor
  return processBatchesWithConcurrency(batches, customerOrderHistoryProcessor, mergedConfig, onProgress);
};
