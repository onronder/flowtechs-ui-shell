
import React from "react";
import { ChevronRight, ChevronDown, AlertCircle, Info, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { TypeField } from "../types";
import FieldArgument from "./FieldArgument";

interface FieldItemProps {
  field: TypeField;
  index: number;
  path: string[];
  isLoading?: boolean;
  toggleSubfields: (field: TypeField, fieldIndex: number, path: string[]) => Promise<void>;
  toggleFieldSelection: (fieldPath: string[], selected: boolean) => void;
  handleArgumentChange: (fieldPath: string[], argName: string, value: string) => void;
  renderFieldsTree: (fields: TypeField[], path: string[]) => React.ReactNode;
}

const FieldItem = ({ 
  field, 
  index, 
  path, 
  isLoading = false,
  toggleSubfields, 
  toggleFieldSelection, 
  handleArgumentChange,
  renderFieldsTree 
}: FieldItemProps) => {
  const currentPath = [...path, field.name];
  const hasArgs = field.args && field.args.length > 0;
  const hasSubfields = field.subfields && field.subfields.length > 0;
  const isExpanded = field.expanded;
  
  return (
    <div className="field-item">
      <div className="flex items-center py-1">
        <div className="w-5">
          <Checkbox
            checked={field.selected}
            onCheckedChange={(checked) => {
              toggleFieldSelection(currentPath, checked === true);
            }}
            id={`field-${currentPath.join('-')}`}
          />
        </div>
        
        <div className="ml-2 flex-grow">
          <div className="flex items-center">
            {field.subfields && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 mr-1"
                onClick={() => toggleSubfields(field, index, path)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            
            <Label
              htmlFor={`field-${currentPath.join('-')}`}
              className={`text-sm ${field.isDeprecated ? 'line-through text-muted-foreground' : ''}`}
            >
              {field.name}
              <span className="text-xs text-muted-foreground ml-2">
                {field.type}
              </span>
            </Label>
            
            {field.isDeprecated && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="h-3 w-3 ml-1 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Deprecated: {field.deprecationReason || 'No reason provided'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
      
      {field.selected && hasArgs && (
        <div className="ml-7 mb-2">
          {field.args.map(arg => (
            <FieldArgument 
              key={arg.name}
              arg={arg}
              fieldPath={currentPath}
              onArgumentChange={handleArgumentChange}
            />
          ))}
        </div>
      )}
      
      {hasSubfields && isExpanded && (
        <div className="ml-5 pl-2 border-l">
          {renderFieldsTree(field.subfields!, currentPath)}
        </div>
      )}
    </div>
  );
};

export default React.memo(FieldItem);
