
// Validation utilities for Shopify source requests

/**
 * Validates the required fields in the source data
 * @param sourceData The source data to validate
 * @returns An object with validation results
 */
export function validateSourceData(sourceData: any) {
  // Define required fields for any Shopify source
  const requiredFields = ['name', 'store_url', 'access_token', 'api_version'];
  const missingFields = requiredFields.filter(field => !sourceData[field]);
  
  const isValid = missingFields.length === 0;
  
  return {
    isValid,
    missingFields,
    message: isValid ? 'Validation successful' : `Missing required fields: ${missingFields.join(', ')}`,
  };
}

/**
 * Sanitizes the store URL to ensure proper format
 * @param storeUrl The store URL to sanitize
 * @returns The sanitized store URL
 */
export function sanitizeStoreUrl(storeUrl: string): string {
  // Add https:// if not present
  let sanitized = storeUrl;
  if (!sanitized.startsWith('https://')) {
    sanitized = `https://${sanitized}`;
  }
  
  // Remove trailing slash if present
  if (sanitized.endsWith('/')) {
    sanitized = sanitized.slice(0, -1);
  }
  
  return sanitized;
}
