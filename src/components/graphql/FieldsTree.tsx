
import { useState, useCallback, useMemo } from "react";
import { TypeField } from "./types";
import { useToast } from "@/components/ui/use-toast";
import FieldItem from "./components/FieldItem";
import { 
  updateExpandedState, 
  updateSubfields, 
  updateFieldSelection, 
  updateArgumentValue 
} from "./utils/fieldsTreeUtils";
import { loadSubfields } from "./services/schemaService";

interface FieldsTreeProps {
  fields: TypeField[];
  onFieldsChange: (newFields: TypeField[]) => void;
  sourceId: string;
}

const FieldsTree = ({ fields, onFieldsChange, sourceId }: FieldsTreeProps) => {
  const { toast } = useToast();
  const [loadingFields, setLoadingFields] = useState<string[]>([]);

  const toggleSubfields = useCallback(async (field: TypeField, fieldIndex: number, path: string[] = []) => {
    // If subfields are already loaded, just toggle expanded state
    if (field.subfields && field.subfields.length > 0) {
      onFieldsChange(updateExpandedState(fields, [...path, field.name], !field.expanded));
      return;
    }
    
    try {
      // Set loading state for this field
      setLoadingFields(prev => [...prev, field.name]);
      
      // Load subfields from the schema
      const subfields = await loadSubfields(field, sourceId);
      
      // Update the field with subfields
      onFieldsChange(updateSubfields(fields, [...path, field.name], subfields));
    } catch (error) {
      console.error("Error loading subfields:", error);
      toast({
        variant: "destructive",
        title: "Failed to load subfields",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      // Clear loading state
      setLoadingFields(prev => prev.filter(name => name !== field.name));
    }
  }, [fields, onFieldsChange, sourceId, toast]);

  const toggleFieldSelection = useCallback((fieldPath: string[], selected: boolean) => {
    onFieldsChange(updateFieldSelection(fields, fieldPath, selected));
  }, [fields, onFieldsChange]);

  const handleArgumentChange = useCallback((fieldPath: string[], argName: string, value: string) => {
    onFieldsChange(updateArgumentValue(fields, fieldPath, argName, value));
  }, [fields, onFieldsChange]);

  // Memoize the field rendering function to prevent unnecessary re-renders
  const renderFieldsTree = useCallback((fields: TypeField[], path: string[] = []) => {
    return (
      <div className="space-y-1">
        {fields.map((field, index) => (
          <FieldItem
            key={field.name}
            field={field}
            index={index}
            path={path}
            isLoading={loadingFields.includes(field.name)}
            toggleSubfields={toggleSubfields}
            toggleFieldSelection={toggleFieldSelection}
            handleArgumentChange={handleArgumentChange}
            renderFieldsTree={renderFieldsTree}
          />
        ))}
      </div>
    );
  }, [loadingFields, toggleSubfields, toggleFieldSelection, handleArgumentChange]);

  // Memoize the entire tree to prevent unnecessary re-renders
  const memoizedFieldsTree = useMemo(() => renderFieldsTree(fields), [fields, renderFieldsTree]);

  return memoizedFieldsTree;
};

export default FieldsTree;
