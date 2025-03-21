
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SchemaExplorerProps, SchemaType, SchemaField } from "./types/schemaTypes";
import { filterTypes } from "./utils/schemaUtils";
import SchemaTypeItem from "./components/SchemaTypeItem";
import SchemaSearchBar from "./components/SchemaSearchBar";

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

  const isFieldSelected = (typeName: string, fieldName: string): boolean => {
    return selectedFields[typeName]?.has(fieldName) || false;
  };

  const handleFieldClick = (field: SchemaField, type: SchemaType) => {
    onFieldSelect(field, type);
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
  const filteredTypes = filterTypes(types, searchQuery, visibleTypes, showDeprecated);

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <SchemaSearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showDeprecated={showDeprecated}
          setShowDeprecated={setShowDeprecated}
          fetchSchema={fetchSchema}
          loading={loading}
        />
        
        <ScrollArea className="h-[600px] pr-4">
          <Accordion
            type="multiple"
            value={expandedTypes}
            onValueChange={setExpandedTypes}
            className="w-full"
          >
            {filteredTypes.map((type: SchemaType) => (
              <SchemaTypeItem
                key={type.name}
                type={type}
                isExpanded={expandedTypes.includes(type.name)}
                showDeprecated={showDeprecated}
                isFieldSelected={isFieldSelected}
                onTypeSelect={onTypeSelect}
                onFieldClick={handleFieldClick}
              />
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SchemaExplorer;
