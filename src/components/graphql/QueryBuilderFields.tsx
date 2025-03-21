
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import FieldsTree from "./FieldsTree";
import { useQueryBuilder } from "./contexts/QueryBuilderContext";

const QueryBuilderFields = () => {
  const { selectedType, fields, setFields, sourceId } = useQueryBuilder();

  if (!selectedType) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Select a type from the Schema Explorer to begin building your query.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="py-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {selectedType.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Select fields to include in your query
            </p>
          </div>
          <Badge variant="outline">
            {fields.filter(f => f.selected).length} / {fields.length} fields
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-24rem)]">
          <FieldsTree 
            fields={fields}
            onFieldsChange={setFields}
            sourceId={sourceId}
          />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default QueryBuilderFields;
