
import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { RateLimitInfo } from '@/integrations/supabase/client';

interface ConnectionStatusDisplayProps {
  connectionStatus: null | 'success' | 'error';
  connectionMessage: string;
  rateLimitInfo: RateLimitInfo | null;
}

const ConnectionStatusDisplay: React.FC<ConnectionStatusDisplayProps> = ({
  connectionStatus,
  connectionMessage,
  rateLimitInfo
}) => {
  if (!connectionStatus) {
    return null;
  }

  return (
    <div className="flex items-center">
      {connectionStatus === 'success' && (
        <div className="flex items-center text-sm text-green-600">
          <CheckCircle className="h-4 w-4 mr-2" />
          {connectionMessage}
          
          {rateLimitInfo && (
            <span className="ml-4 text-xs bg-green-100 px-2 py-0.5 rounded-full">
              Rate limit: {rateLimitInfo.available}/{rateLimitInfo.maximum}
            </span>
          )}
        </div>
      )}
      
      {connectionStatus === 'error' && (
        <div className="flex items-center text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mr-2" />
          {connectionMessage}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatusDisplay;
