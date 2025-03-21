
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQueryBuilder } from "./contexts/QueryBuilderContext";

const QueryBuilderHeader = () => {
  const { queryName, setQueryName, complexity } = useQueryBuilder();

  const getComplexityColor = () => {
    if (complexity < 10) return "bg-green-500";
    if (complexity < 20) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Label htmlFor="query-name">Query Name:</Label>
        <Input
          id="query-name"
          value={queryName}
          onChange={(e) => setQueryName(e.target.value)}
          className="w-48"
        />
      </div>
      <div className="flex items-center space-x-2">
        <div className="text-sm">Complexity:</div>
        <Badge className={getComplexityColor()}>
          {complexity}
        </Badge>
      </div>
    </div>
  );
};

export default QueryBuilderHeader;
