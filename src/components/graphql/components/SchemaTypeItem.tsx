
import React from "react";
import { InfoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { SchemaType, SchemaField } from "../types/schemaTypes";

interface SchemaTypeItemProps {
  type: SchemaType;
  isExpanded: boolean;
  showDeprecated: boolean;
  isFieldSelected: (typeName: string, fieldName: string) => boolean;
  onTypeSelect: (type: SchemaType) => void;
  onFieldClick: (field: SchemaField, type: SchemaType) => void;
}

const SchemaTypeItem = ({
  type,
  isExpanded,
  showDeprecated,
  isFieldSelected,
  onTypeSelect,
  onFieldClick,
}: SchemaTypeItemProps) => {
  return (
    <AccordionItem 
      key={type.name} 
      value={type.name}
      className="border rounded-md mb-2 px-2"
    >
      <div className="flex items-center">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center">
            <span className="font-medium">{type.name}</span>
            <Badge variant="outline" className="ml-2 text-xs">
              {type.kind.toLowerCase()}
            </Badge>
          </div>
        </AccordionTrigger>
        <div className="flex items-center ml-auto mr-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTypeSelect(type);
                  }}
                >
                  <InfoIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                View type details
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <AccordionContent>
        {type.description && (
          <p className="text-sm text-muted-foreground mb-2">
            {type.description}
          </p>
        )}
        
        {type.fields && (
          <div className="space-y-1">
            {type.fields
              .filter(field => showDeprecated || !field.isDeprecated)
              .map((field) => (
                <SchemaFieldItem 
                  key={field.name}
                  field={field}
                  type={type}
                  isSelected={isFieldSelected(type.name, field.name)}
                  onFieldClick={onFieldClick}
                />
              ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

// SchemaFieldItem component
interface SchemaFieldItemProps {
  field: SchemaField;
  type: SchemaType;
  isSelected: boolean;
  onFieldClick: (field: SchemaField, type: SchemaType) => void;
}

const SchemaFieldItem = ({ field, type, isSelected, onFieldClick }: SchemaFieldItemProps) => {
  const getTypeName = (typeRef: any): string => {
    if (typeRef.kind === 'NON_NULL') {
      return `${getTypeName(typeRef.ofType)}!`;
    }
    if (typeRef.kind === 'LIST') {
      return `[${getTypeName(typeRef.ofType)}]`;
    }
    return typeRef.name || 'Unknown';
  };

  return (
    <div 
      className={`flex items-center p-1 rounded-md text-sm hover:bg-accent ${
        isSelected ? 'bg-accent/50' : ''
      } cursor-pointer`}
      onClick={() => onFieldClick(field, type)}
    >
      <div className="w-1/3 font-medium truncate">
        {field.name}
        {field.isDeprecated && (
          <Badge variant="destructive" className="ml-1 text-xs">
            deprecated
          </Badge>
        )}
      </div>
      <div className="w-1/3 text-xs text-muted-foreground truncate">
        {getTypeName(field.type)}
      </div>
      {field.description && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="h-3 w-3 ml-1 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              {field.description}
              {field.isDeprecated && field.deprecationReason && (
                <div className="text-destructive mt-1">
                  {field.deprecationReason}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

export default SchemaTypeItem;
