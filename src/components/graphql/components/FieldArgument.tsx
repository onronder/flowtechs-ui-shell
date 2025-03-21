
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Info } from "lucide-react";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { FieldArgument as FieldArgumentType } from "../types";

interface FieldArgumentProps {
  arg: FieldArgumentType;
  fieldPath: string[];
  onArgumentChange: (fieldPath: string[], argName: string, value: string) => void;
}

const FieldArgument = ({ arg, fieldPath, onArgumentChange }: FieldArgumentProps) => {
  return (
    <div className="flex items-center mt-1">
      <Label className="text-xs w-1/3">{arg.name}:</Label>
      <Input
        value={arg.value || ''}
        onChange={(e) => onArgumentChange(fieldPath, arg.name, e.target.value)}
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
  );
};

export default FieldArgument;
