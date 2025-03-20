
import { useState } from "react";
import { TypeField, FieldArgument } from "./types";
import { ChevronRight, ChevronDown, AlertCircle, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FieldsTreeProps {
  fields: TypeField[];
  onFieldsChange: (newFields: TypeField[]) => void;
  sourceId: string;
}

const FieldsTree = ({ fields, onFieldsChange, sourceId }: FieldsTreeProps) => {
  const { toast } = useToast();

  const toggleSubfields = async (field: TypeField, fieldIndex: number, path: string[] = []) => {
    // If subfields are already loaded, just toggle expanded state
    if (field.subfields && field.subfields.length > 0) {
      onFieldsChange(updateExpandedState(fields, [...path, field.name], !field.expanded));
      return;
    }
    
    try {
      // We need to load the subfields from the schema
      const baseTypeName = field.type.replace(/[\[\]!]/g, '');
      
      // Find the type in the schema
      const response = await supabase.functions.invoke('introspect-shopify-schema', {
        body: { sourceId }
      });
      
      if (response.error || !response.data.success) {
        throw new Error(response.error?.message || response.data.error || 'Failed to load schema');
      }
      
      const schema = response.data.schema;
      const subType = schema.__schema.types.find((t: any) => t.name === baseTypeName);
      
      if (!subType || !subType.fields) {
        throw new Error(`Type ${baseTypeName} not found in schema or has no fields`);
      }
      
      // Convert fields to our format
      const subfields: TypeField[] = subType.fields.map((subfield: any) => {
        const getBaseType = (typeRef: any): any => {
          if (!typeRef.ofType) return typeRef;
          return getBaseType(typeRef.ofType);
        };
        
        const baseType = getBaseType(subfield.type);
        const isObjectType = baseType.kind === 'OBJECT' || baseType.kind === 'INTERFACE';
        
        return {
          name: subfield.name,
          type: getTypeName(subfield.type),
          description: subfield.description,
          args: subfield.args.map((arg: any) => ({
            name: arg.name,
            type: getTypeName(arg.type),
            description: arg.description,
            defaultValue: arg.defaultValue,
            value: ''
          })),
          selected: false,
          expanded: false,
          isDeprecated: subfield.isDeprecated,
          deprecationReason: subfield.deprecationReason,
          subfields: isObjectType ? [] : undefined
        };
      });
      
      // Update the field with subfields
      onFieldsChange(updateSubfields(fields, [...path, field.name], subfields));
    } catch (error) {
      console.error("Error loading subfields:", error);
      toast({
        variant: "destructive",
        title: "Failed to load subfields",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const toggleFieldSelection = (fieldPath: string[], selected: boolean) => {
    onFieldsChange(updateFieldSelection(fields, fieldPath, selected));
  };

  const handleArgumentChange = (fieldPath: string[], argName: string, value: string) => {
    onFieldsChange(updateArgumentValue(fields, fieldPath, argName, value));
  };

  const getTypeName = (typeRef: any): string => {
    if (typeRef.kind === 'NON_NULL') {
      return `${getTypeName(typeRef.ofType)}!`;
    }
    if (typeRef.kind === 'LIST') {
      return `[${getTypeName(typeRef.ofType)}]`;
    }
    return typeRef.name || 'Unknown';
  };

  const updateExpandedState = (fields: TypeField[], path: string[], expanded: boolean): TypeField[] => {
    return fields.map(field => {
      if (field.name === path[0]) {
        if (path.length === 1) {
          return { ...field, expanded };
        } else if (field.subfields) {
          return {
            ...field,
            subfields: updateExpandedState(field.subfields, path.slice(1), expanded)
          };
        }
      }
      return field;
    });
  };

  const updateSubfields = (fields: TypeField[], path: string[], subfields: TypeField[]): TypeField[] => {
    return fields.map(field => {
      if (field.name === path[0]) {
        if (path.length === 1) {
          return { ...field, subfields, expanded: true };
        } else if (field.subfields) {
          return {
            ...field,
            subfields: updateSubfields(field.subfields, path.slice(1), subfields)
          };
        }
      }
      return field;
    });
  };

  const updateFieldSelection = (fields: TypeField[], path: string[], selected: boolean): TypeField[] => {
    return fields.map(field => {
      if (field.name === path[0]) {
        if (path.length === 1) {
          return { ...field, selected };
        } else if (field.subfields) {
          return {
            ...field,
            subfields: updateFieldSelection(field.subfields, path.slice(1), selected)
          };
        }
      }
      return field;
    });
  };

  const updateArgumentValue = (fields: TypeField[], path: string[], argName: string, value: string): TypeField[] => {
    return fields.map(field => {
      if (field.name === path[0]) {
        if (path.length === 1) {
          return {
            ...field,
            args: field.args.map(arg => 
              arg.name === argName ? { ...arg, value } : arg
            )
          };
        } else if (field.subfields) {
          return {
            ...field,
            subfields: updateArgumentValue(field.subfields, path.slice(1), argName, value)
          };
        }
      }
      return field;
    });
  };

  const renderFieldsTree = (fields: TypeField[], path: string[] = []) => {
    return (
      <div className="space-y-1">
        {fields.map((field, index) => {
          const currentPath = [...path, field.name];
          const hasArgs = field.args && field.args.length > 0;
          const hasSubfields = field.subfields && field.subfields.length > 0;
          const isExpanded = field.expanded;
          
          return (
            <div key={field.name} className="field-item">
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
                      >
                        {isExpanded ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
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
                    <div key={arg.name} className="flex items-center mt-1">
                      <Label className="text-xs w-1/3">{arg.name}:</Label>
                      <Input
                        value={arg.value || ''}
                        onChange={(e) => handleArgumentChange(currentPath, arg.name, e.target.value)}
                        placeholder={arg.defaultValue || arg.type}
                        className="h-6 text-xs"
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 ml-1 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{arg.description || 'No description'}</p>
                            <p className="text-xs mt-1">Type: {arg.type}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
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
        })}
      </div>
    );
  };

  return renderFieldsTree(fields);
};

export default FieldsTree;
