
import { useState } from "react";
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

  const toggleSubfields = async (field: TypeField, fieldIndex: number, path: string[] = []) => {
    // If subfields are already loaded, just toggle expanded state
    if (field.subfields && field.subfields.length > 0) {
      onFieldsChange(updateExpandedState(fields, [...path, field.name], !field.expanded));
      return;
    }
    
    try {
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
    }
  };

  const toggleFieldSelection = (fieldPath: string[], selected: boolean) => {
    onFieldsChange(updateFieldSelection(fields, fieldPath, selected));
  };

  const handleArgumentChange = (fieldPath: string[], argName: string, value: string) => {
    onFieldsChange(updateArgumentValue(fields, fieldPath, argName, value));
  };

  const renderFieldsTree = (fields: TypeField[], path: string[] = []) => {
    return (
      <div className="space-y-1">
        {fields.map((field, index) => (
          <FieldItem
            key={field.name}
            field={field}
            index={index}
            path={path}
            toggleSubfields={toggleSubfields}
            toggleFieldSelection={toggleFieldSelection}
            handleArgumentChange={handleArgumentChange}
            renderFieldsTree={renderFieldsTree}
          />
        ))}
      </div>
    );
  };

  return renderFieldsTree(fields);
};

export default FieldsTree;
