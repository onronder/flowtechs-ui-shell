
import { supabase, logAuditEvent, testConnection } from './utils.ts';

interface SourceData {
  id?: string;
  name: string;
  description?: string;
  store_url: string;
  store_name?: string;
  api_version: string;
  access_token: string;
  metadata?: Record<string, any>;
}

/**
 * Save Shopify source data to the database
 * @param data Source data to save
 * @param userId User ID for the source
 * @returns Object with success status and saved source
 */
export async function saveShopifySource(data: SourceData, userId: string) {
  try {
    console.log('Saving Shopify source with data:', { ...data, access_token: '***REDACTED***' });
    console.log('Using user ID for save operation:', userId);
    
    // Check if this is an update or a new source
    const isUpdate = !!data.id;
    
    // Prepare metadata with non-sensitive settings
    const metadata = {
      ...data.metadata,
      store_url: data.store_url,
      // We'll encrypt API key and secret separately in a real implementation
      last_updated: new Date().toISOString(),
    };
    
    // Prepare source data to save
    const sourceData = {
      name: data.name,
      description: data.description,
      type: 'shopify' as const,
      store_name: data.store_name,
      api_version: data.api_version,
      access_token: data.access_token, // Will be encrypted by the database trigger
      connection_status: 'disconnected' as const,
      metadata
    };
    
    console.log('Prepared source data for saving:', { ...sourceData, access_token: '***REDACTED***' });
    
    let result;
    
    if (isUpdate) {
      result = await updateExistingSource(data.id as string, sourceData, userId);
    } else {
      result = await createNewSource(sourceData, userId);
    }
    
    // Test the connection immediately after saving
    try {
      console.log('Testing connection after save for source ID:', result.id);
      await testConnection(result.id);
    } catch (connError) {
      console.error('Connection test failed, but source was saved:', connError);
      // Don't fail the whole operation if just the test fails
    }
    
    return {
      success: true,
      source: result,
    };
  } catch (error) {
    console.error('Error saving Shopify source:', error);
    throw error;
  }
}

/**
 * Update an existing Shopify source
 * @param sourceId ID of the source to update
 * @param sourceData Source data to update
 * @param userId User ID for audit logging
 * @returns Updated source data
 */
async function updateExistingSource(sourceId: string, sourceData: any, userId: string) {
  console.log(`Updating existing source with ID: ${sourceId}`);
  const { data: updateResult, error } = await supabase
    .from('sources')
    .update(sourceData)
    .eq('id', sourceId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating source:', error);
    throw error;
  }
  
  console.log('Source updated successfully');
  
  // Only log the audit event if userId is provided
  if (userId) {
    try {
      await logAuditEvent(
        userId,
        'sources',
        sourceId,
        'UPDATE',
        'Updated Shopify source credentials',
        { name: sourceData.name }
      );
    } catch (error) {
      console.warn('Failed to log audit event during update, but source was updated:', error);
    }
  } else {
    console.warn('No user ID provided for audit logging during update');
  }
  
  return updateResult;
}

/**
 * Create a new Shopify source
 * @param sourceData Source data to create
 * @param userId User ID for the source owner
 * @returns Created source data
 */
async function createNewSource(sourceData: any, userId: string) {
  console.log('Creating new source for user:', userId);
  
  if (!userId) {
    throw new Error('User ID is required to create a new source');
  }
  
  const { data: insertResult, error } = await supabase
    .from('sources')
    .insert({
      ...sourceData,
      user_id: userId,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating source:', error);
    throw error;
  }
  
  console.log('Source created successfully with ID:', insertResult?.id);
  
  // Only log the audit event if userId is provided
  if (userId) {
    try {
      await logAuditEvent(
        userId,
        'sources',
        insertResult.id,
        'INSERT',
        'Created new Shopify source',
        { name: sourceData.name }
      );
    } catch (error) {
      console.warn('Failed to log audit event during insert, but source was created:', error);
    }
  } else {
    console.warn('No user ID provided for audit logging during insert');
  }
  
  return insertResult;
}
