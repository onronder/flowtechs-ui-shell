
import { useState, useEffect } from "react";
import { Loader2, Search, InfoIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SchemaType {
  kind: string;
  name: string;
  description: string | null;
  fields: SchemaField[] | null;
  inputFields: SchemaInputValue[] | null;
  interfaces: SchemaTypeRef[] | null;
  enumValues: SchemaEnumValue[] | null;
  possibleTypes: SchemaTypeRef[] | null;
}

interface SchemaField {
  name: string;
  description: string | null;
  args: SchemaInputValue[];
  type: SchemaTypeRef;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

interface SchemaInputValue {
  name: string;
  description: string | null;
  type: SchemaTypeRef;
  defaultValue: string | null;
}

interface SchemaTypeRef {
  kind: string;
  name: string | null;
  ofType: SchemaTypeRef | null;
}

interface SchemaEnumValue {
  name: string;
  description: string | null;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

interface SchemaExplorerProps {
  sourceId: string;
  onTypeSelect: (type: SchemaType) => void;
  onFieldSelect: (field: SchemaField, parentType: SchemaType) => void;
  selectedFields: Record<string, Set<string>>;
}

const SchemaExplorer = ({ 
  sourceId, 
  onTypeSelect, 
  onFieldSelect,
  selectedFields 
}: SchemaExplorerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [visibleTypes, setVisibleTypes] = useState<string[]>([]);
  const [showDeprecated, setShowDeprecated] = useState(false);

  useEffect(() => {
    if (sourceId) {
      fetchSchema();
    }
  }, [sourceId]);

  const fetchSchema = async () => {
    try {
      setLoading(true);
      const response = await supabase.functions.invoke('introspect-shopify-schema', {
        body: { sourceId }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch schema');
      }

      setSchema(response.data.schema);
      
      // Initially show only the main types
      const initialVisibleTypes = response.data.schema.__schema.types
        .filter((type: SchemaType) => {
          return (
            !type.name.startsWith('__') && 
            ['OBJECT', 'INTERFACE'].includes(type.kind) &&
            !type.name.endsWith('Connection') &&
            !type.name.endsWith('Edge')
          );
        })
        .map((type: SchemaType) => type.name);
      
      setVisibleTypes(initialVisibleTypes);
      
      toast({
        title: "Schema loaded",
        description: response.data.fromCache 
          ? "Using cached schema from database" 
          : "Fresh schema fetched from Shopify API"
      });
    } catch (error) {
      console.error("Error fetching schema:", error);
      toast({
        variant: "destructive",
        title: "Failed to load schema",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTypeFromRef = (typeRef: SchemaTypeRef): { kind: string, name: string } => {
    if (typeRef.kind !== 'NON_NULL' && typeRef.kind !== 'LIST' && typeRef.name) {
      return { kind: typeRef.kind, name: typeRef.name };
    }
    if (typeRef.ofType) {
      return getTypeFromRef(typeRef.ofType);
    }
    return { kind: 'UNKNOWN', name: 'Unknown' };
  };

  const getTypeName = (typeRef: SchemaTypeRef): string => {
    if (typeRef.kind === 'NON_NULL') {
      return `${getTypeName(typeRef.ofType!)}!`;
    }
    if (typeRef.kind === 'LIST') {
      return `[${getTypeName(typeRef.ofType!)}]`;
    }
    return typeRef.name || 'Unknown';
  };

  const toggleTypeExpansion = (typeName: string) => {
    setExpandedTypes(prev =>
      prev.includes(typeName)
        ? prev.filter(t => t !== typeName)
        : [...prev, typeName]
    );
  };

  const toggleTypeVisibility = (typeName: string) => {
    setVisibleTypes(prev =>
      prev.includes(typeName)
        ? prev.filter(t => t !== typeName)
        : [...prev, typeName]
    );
  };

  const isFieldSelected = (typeName: string, fieldName: string): boolean => {
    return selectedFields[typeName]?.has(fieldName) || false;
  };

  const handleFieldClick = (field: SchemaField, type: SchemaType) => {
    onFieldSelect(field, type);
  };

  const filterTypes = (types: SchemaType[]) => {
    if (!types) return [];
    
    return types
      .filter(type => 
        !type.name.startsWith('__') && 
        visibleTypes.includes(type.name) &&
        (showDeprecated || !type.name.includes('Deprecated')) &&
        (searchQuery === '' || 
          type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          type.description?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading schema...</span>
      </div>
    );
  }

  if (!schema) {
    return (
      <Alert>
        <AlertDescription>
          No schema found. Please select a valid Shopify source.
        </AlertDescription>
      </Alert>
    );
  }

  const types = schema.__schema.types;
  const filteredTypes = filterTypes(types);

  return (
    <Card className="h-full">
      <CardContent className="p-4">
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
        
        <ScrollArea className="h-[600px] pr-4">
          <Accordion
            type="multiple"
            value={expandedTypes}
            onValueChange={setExpandedTypes}
            className="w-full"
          >
            {filteredTypes.map((type) => (
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
                          <div 
                            key={field.name}
                            className={`flex items-center p-1 rounded-md text-sm hover:bg-accent ${
                              isFieldSelected(type.name, field.name) ? 'bg-accent/50' : ''
                            } cursor-pointer`}
                            onClick={() => handleFieldClick(field, type)}
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
                        ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SchemaExplorer;
