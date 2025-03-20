
import { useForm, FormProvider } from "react-hook-form";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SaveTemplateFormValues {
  templateName: string;
  templateDescription: string;
}

interface SaveTemplateDialogProps {
  onSave: (data: SaveTemplateFormValues) => void;
  onCancel: () => void;
}

const SaveTemplateDialog = ({ onSave, onCancel }: SaveTemplateDialogProps) => {
  const form = useForm<SaveTemplateFormValues>({
    defaultValues: {
      templateName: "",
      templateDescription: "",
    }
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Save Query Template</DialogTitle>
      </DialogHeader>
      
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSave)}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="templateName">Name</Label>
              <Input 
                id="templateName"
                {...form.register("templateName", { required: true })}
              />
            </div>
            
            <div>
              <Label htmlFor="templateDescription">Description</Label>
              <Textarea 
                id="templateDescription"
                {...form.register("templateDescription")}
              />
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Save Template</Button>
          </DialogFooter>
        </form>
      </FormProvider>
    </DialogContent>
  );
};

export default SaveTemplateDialog;
