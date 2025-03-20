
import { QueryTemplate } from "./types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

interface QueryTemplatesProps {
  templates: QueryTemplate[];
  onLoadTemplate: (template: QueryTemplate) => void;
}

const QueryTemplates = ({ templates, onLoadTemplate }: QueryTemplatesProps) => {
  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No saved templates yet. Build a query and save it as a template.
        </p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates.map((template) => (
        <Card 
          key={template.id} 
          className="cursor-pointer hover:border-primary" 
          onClick={() => onLoadTemplate(template)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{template.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {template.description || 'No description'}
            </p>
            <div className="flex justify-between items-center mt-2">
              <Badge variant="outline">
                Complexity: {template.complexity}
              </Badge>
              <p className="text-xs text-muted-foreground">
                Created: {new Date(template.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default QueryTemplates;
