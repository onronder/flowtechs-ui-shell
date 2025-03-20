
import { QueryVariable } from "./types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface QueryVariablesProps {
  variables: QueryVariable[];
  onVariableChange: (index: number, field: keyof QueryVariable, value: string) => void;
}

const QueryVariables = ({ variables, onVariableChange }: QueryVariablesProps) => {
  if (variables.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No variables defined yet. Add arguments to fields to create variables.
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {variables.map((variable, index) => (
        <div key={index} className="flex items-center space-x-2">
          <div className="w-1/4">
            <Label htmlFor={`var-name-${index}`} className="text-xs">Name</Label>
            <Input
              id={`var-name-${index}`}
              value={variable.name}
              onChange={(e) => onVariableChange(index, 'name', e.target.value)}
              className="h-8"
            />
          </div>
          <div className="w-1/4">
            <Label htmlFor={`var-type-${index}`} className="text-xs">Type</Label>
            <Input
              id={`var-type-${index}`}
              value={variable.type}
              onChange={(e) => onVariableChange(index, 'type', e.target.value)}
              className="h-8"
              disabled
            />
          </div>
          <div className="w-2/4">
            <Label htmlFor={`var-default-${index}`} className="text-xs">Default Value</Label>
            <Input
              id={`var-default-${index}`}
              value={variable.defaultValue}
              onChange={(e) => onVariableChange(index, 'defaultValue', e.target.value)}
              className="h-8"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default QueryVariables;
