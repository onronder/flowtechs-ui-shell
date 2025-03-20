
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import DatasetList from "@/components/datasets/DatasetList";
import DatasetForm from "@/components/datasets/DatasetForm";
import DatasetView from "@/components/datasets/DatasetView";
import DatasetTemplateList from "@/components/datasets/DatasetTemplateList";
import { supabase, DatasetTemplate } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WandSparkles } from "lucide-react";

const Datasets = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("datasets");
  const [templates, setTemplates] = useState<DatasetTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const { toast } = useToast();
  
  // Load templates on component mount
  useEffect(() => {
    fetchTemplates();
  }, []);
  
  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const { data, error } = await supabase
        .from('dataset_templates')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      // Cast data to DatasetTemplate[] type to fix type mismatch
      setTemplates(data as unknown as DatasetTemplate[]);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        variant: "destructive",
        title: "Failed to load templates",
        description: "There was an error loading dataset templates."
      });
    } finally {
      setLoadingTemplates(false);
    }
  };
  
  // Check if we're on the base datasets path
  const isBasePath = location.pathname === "/datasets";
  
  // If not on the base path, render the dataset form or view
  if (!isBasePath) {
    return <Outlet />;
  }
  
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Datasets</h1>
          <p className="text-muted-foreground">
            Create and manage datasets from your connected sources.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/custom-query">
            <WandSparkles className="mr-2 h-4 w-4" />
            Custom Query Builder
          </Link>
        </Button>
      </div>
      
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          navigate(value === "datasets" ? "/datasets" : "/datasets/templates");
        }}
      >
        <TabsList>
          <TabsTrigger value="datasets">Datasets</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="datasets" className="mt-6">
          <DatasetList />
        </TabsContent>
        
        <TabsContent value="templates" className="mt-6">
          <DatasetTemplateList 
            templates={templates} 
            loading={loadingTemplates} 
            onRefresh={fetchTemplates} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// This component handles the routing within the Datasets section
const DatasetsRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Datasets />} />
      <Route path="/new" element={<DatasetForm />} />
      <Route path="/edit/:id" element={<DatasetForm />} />
      <Route path="/:id" element={<DatasetView />} />
    </Routes>
  );
};

export default DatasetsRoutes;
