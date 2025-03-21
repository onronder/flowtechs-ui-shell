
import React from "react";
import { Search, EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SchemaSearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showDeprecated: boolean;
  setShowDeprecated: (show: boolean) => void;
  fetchSchema: () => void;
  loading: boolean;
}

const SchemaSearchBar = ({
  searchQuery,
  setSearchQuery,
  showDeprecated,
  setShowDeprecated,
  fetchSchema,
  loading,
}: SchemaSearchBarProps) => {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Search className="h-4 w-4 opacity-50" />
      <Input
        placeholder="Search types and fields..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-9"
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowDeprecated(!showDeprecated)}
            >
              {showDeprecated ? (
                <EyeIcon className="h-4 w-4" />
              ) : (
                <EyeOffIcon className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {showDeprecated ? "Hide deprecated types" : "Show deprecated types"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={fetchSchema}
        disabled={loading}
      >
        Refresh Schema
      </Button>
    </div>
  );
};

export default SchemaSearchBar;
