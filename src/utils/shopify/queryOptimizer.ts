
import { TypeField } from "@/components/graphql/types";

// Function to optimize a GraphQL query by removing unnecessary fields
export function optimizeGraphQLQuery(query: string): string {
  // Remove comments
  const withoutComments = query.replace(/#.*$/gm, '');
  
  // Reduce whitespace
  const withoutExcessWhitespace = withoutComments.replace(/\s+/g, ' ').trim();
  
  // Remove empty blocks
  const withoutEmptyBlocks = withoutExcessWhitespace.replace(/\{\s*\}/g, '{}');
  
  return withoutEmptyBlocks;
}

// Function to calculate the estimated complexity of a query
export function estimateQueryComplexity(
  queryString: string,
  complexityMap: Record<string, number> = {}
): number {
  // Default complexity values for different operations
  const defaultComplexity: Record<string, number> = {
    query: 1,
    node: 1,
    edges: 5,
    nodes: 10,
    connection: 5,
    metafield: 2,
    metafields: 5,
    image: 2,
    media: 5,
    product: 10,
    customer: 10,
    order: 15,
    variants: 5
  };

  // Combine with provided complexity map
  const actualComplexityMap = { ...defaultComplexity, ...complexityMap };
  
  let totalComplexity = 1; // Base complexity
  
  // Extract operations and fields
  const operations = queryString.match(/\w+\s*(\(.*?\))?\s*{/g) || [];
  
  for (const operation of operations) {
    // Extract operation name without arguments or brackets
    const opName = operation.replace(/\(.*?\)/, '').replace(/[{}]/g, '').trim();
    
    // Add complexity for this operation
    for (const [pattern, value] of Object.entries(actualComplexityMap)) {
      if (opName.includes(pattern)) {
        totalComplexity += value;
        break;
      }
    }
  }
  
  // Count curly braces as a rough measure of nesting depth
  const openBraces = (queryString.match(/{/g) || []).length;
  const closeBraces = (queryString.match(/}/g) || []).length;
  
  if (openBraces === closeBraces) {
    // Add complexity based on nesting level
    totalComplexity += Math.max(0, openBraces - 1) * 2;
  }
  
  // Add complexity for pagination arguments
  const paginationArgs = (queryString.match(/first:\s*\d+/g) || []);
  for (const arg of paginationArgs) {
    const limit = parseInt(arg.replace(/first:\s*/, ''));
    if (!isNaN(limit)) {
      // Higher limits increase complexity
      totalComplexity += Math.min(10, Math.ceil(limit / 10));
    }
  }
  
  return Math.round(totalComplexity);
}

// Optimize field selection to reduce query complexity
export function optimizeFieldSelection(
  fields: TypeField[],
  maxComplexity: number = 50
): TypeField[] {
  // Sort fields by importance (you can define a custom scoring function)
  const scoredFields = fields.map(field => {
    // Sample scoring logic - can be customized
    let score = 0;
    
    // Prioritize ID fields
    if (field.name === 'id') score += 100;
    
    // Basic fields get higher scores
    if (['title', 'name', 'handle', 'email', 'createdAt', 'updatedAt'].includes(field.name)) {
      score += 75;
    }
    
    // Complex types have lower priority in auto-selection
    if (
      field.type.includes('Connection') || 
      field.type.includes('Edge') ||
      field.name === 'metafields'
    ) {
      score -= 50;
    }
    
    return { ...field, score };
  });
  
  // Sort by score
  scoredFields.sort((a, b) => b.score - a.score);
  
  // Start with high-priority fields and add more until reaching complexity threshold
  let currentComplexity = 1; // Base complexity
  const selectedFields: TypeField[] = [];
  
  for (const field of scoredFields) {
    let fieldComplexity = 1;
    
    // Assign complexity based on field type
    if (field.type.includes('Connection')) fieldComplexity = 5;
    if (field.name === 'metafields') fieldComplexity = 5;
    if (field.subfields && field.subfields.length > 0) {
      fieldComplexity += Math.min(5, field.subfields.length / 2);
    }
    
    // Check if adding this field would exceed our limit
    if (currentComplexity + fieldComplexity <= maxComplexity || field.name === 'id') {
      selectedFields.push({ ...field, selected: true });
      currentComplexity += fieldComplexity;
    } else {
      selectedFields.push({ ...field, selected: false });
    }
  }
  
  return selectedFields;
}

// Helper to automatically extract useful fields from a schema type
export function extractUsefulFields(type: any): string[] {
  if (!type || !type.fields) return [];
  
  const fieldsByCategory = {
    essential: ['id', 'title', 'name', 'sku', 'handle', 'email', 'status'],
    important: ['createdAt', 'updatedAt', 'displayName', 'description', 'price', 'quantity'],
    useful: ['tags', 'vendor', 'type', 'position', 'phone', 'address', 'available'],
    optional: []
  };
  
  const availableFields = type.fields.map((f: any) => f.name);
  
  // Filter field categories by availability in the type
  const selectedFields = [
    ...fieldsByCategory.essential.filter(f => availableFields.includes(f)),
    ...fieldsByCategory.important.filter(f => availableFields.includes(f)),
    ...fieldsByCategory.useful.filter(f => availableFields.includes(f))
  ];
  
  // If we have very few fields, add some optional ones
  if (selectedFields.length < 5) {
    // Add remaining fields up to 10 total
    const remainingFields = availableFields
      .filter(f => !selectedFields.includes(f))
      .slice(0, 10 - selectedFields.length);
    
    selectedFields.push(...remainingFields);
  }
  
  return selectedFields;
}

// Generate a GraphQL query with optimized field selection
export function generateOptimizedQuery(
  typeName: string,
  fields: string[],
  queryName: string = 'getItems',
  variables: Record<string, { type: string; defaultValue?: string }> = {},
  maxComplexity: number = 50
): string {
  // Build variable declarations
  const varDeclarations = Object.entries(variables)
    .map(([name, details]) => `$${name}: ${details.type}`)
    .join(', ');
  
  // Build variable assignments
  const varAssignments = Object.entries(variables)
    .map(([name]) => `${name}: $${name}`)
    .join(', ');
  
  // Start building the query
  let query = `query ${queryName}(${varDeclarations}) {\n`;
  
  // Add the main query operation
  if (varAssignments) {
    query += `  ${typeName}(${varAssignments}) {\n`;
  } else {
    query += `  ${typeName} {\n`;
  }
  
  // Add selected fields
  for (const field of fields) {
    query += `    ${field}\n`;
  }
  
  // Close the query
  query += '  }\n}';
  
  // Check complexity and optimize if needed
  const complexity = estimateQueryComplexity(query);
  
  if (complexity > maxComplexity) {
    console.warn(`Query complexity (${complexity}) exceeds maximum (${maxComplexity}). Optimizing...`);
    return optimizeGraphQLQuery(query);
  }
  
  return query;
}
