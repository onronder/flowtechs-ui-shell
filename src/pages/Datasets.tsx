
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import DatasetList from "@/components/datasets/DatasetList";
import DatasetForm from "@/components/datasets/DatasetForm";
import DatasetView from "@/components/datasets/DatasetView";

const Datasets = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("datasets");
  
  // Check if we're on the base datasets path
  const isBasePath = location.pathname === "/datasets";
  
  // If not on the base path, render the dataset form or view
  if (!isBasePath) {
    return <Outlet />;
  }
  
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Datasets</h1>
        <p className="text-muted-foreground">
          Create and manage datasets from your connected sources.
        </p>
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
          <div className="text-center p-12 text-muted-foreground">
            Dataset templates will be available in a future update.
          </div>
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
