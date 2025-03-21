
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, BarChart2, FileDown, FileEdit, Trash, RefreshCw, Code, LineChart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase, Dataset } from '@/integrations/supabase/client';

interface DatasetViewActionsProps {
  dataset: Dataset;
  onRefresh?: () => void;
  onDelete?: () => void;
}

export function DatasetViewActions({ dataset, onRefresh, onDelete }: DatasetViewActionsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const handleEdit = () => {
    navigate(`/datasets/edit/${dataset.id}`);
  };
  
  const handleAdvancedVisualization = () => {
    navigate(`/visualization/${dataset.id}`);
  };
  
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this dataset?')) {
      return;
    }
    
    try {
      await supabase
        .from('datasets')
        .delete()
        .eq('id', dataset.id);
      
      toast({
        title: 'Dataset deleted',
        description: 'The dataset has been successfully deleted.',
      });
      
      if (onDelete) {
        onDelete();
      } else {
        navigate('/datasets');
      }
    } catch (error) {
      console.error('Error deleting dataset:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'There was an error deleting the dataset.',
      });
    }
  };
  
  const handleRefresh = async () => {
    try {
      await supabase
        .from('datasets')
        .update({ status: 'queued' })
        .eq('id', dataset.id);
      
      toast({
        title: 'Dataset refresh queued',
        description: 'The dataset will be refreshed in the background.',
      });
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error refreshing dataset:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'There was an error queuing the dataset refresh.',
      });
    }
  };
  
  return (
    <div className="flex items-center space-x-2">
      <Button variant="outline" size="sm" onClick={handleAdvancedVisualization}>
        <BarChart2 className="mr-2 h-4 w-4" />
        Advanced Visualization
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleEdit}>
            <FileEdit className="mr-2 h-4 w-4" />
            Edit Dataset
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Data
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleAdvancedVisualization}>
            <LineChart className="mr-2 h-4 w-4" />
            Enterprise Visualization
          </DropdownMenuItem>
          <DropdownMenuItem>
            <FileDown className="mr-2 h-4 w-4" />
            Export Data
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Code className="mr-2 h-4 w-4" />
            View API Access
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="text-red-600">
            <Trash className="mr-2 h-4 w-4" />
            Delete Dataset
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
