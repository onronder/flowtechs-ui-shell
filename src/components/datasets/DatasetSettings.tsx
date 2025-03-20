
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dataset, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// Form validation schema
const settingsSchema = z.object({
  batch_size: z.coerce.number().int().min(10).max(250),
  max_retries: z.coerce.number().int().min(0).max(10),
  throttle_delay_ms: z.coerce.number().int().min(0).max(10000),
  circuit_breaker_threshold: z.coerce.number().int().min(1).max(20),
  timeout_seconds: z.coerce.number().int().min(5).max(120),
  refresh_frequency: z.enum(["daily", "weekly", "monthly", "none"]).default("none"),
  auto_refresh_enabled: z.boolean().default(false),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface DatasetSettingsProps {
  dataset: Dataset;
  onUpdate: () => void;
}

const DatasetSettings = ({ dataset, onUpdate }: DatasetSettingsProps) => {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  
  // Extract settings from dataset
  const extractionSettings = dataset.extraction_settings || {
    batch_size: 100,
    max_retries: 3,
    throttle_delay_ms: 1000,
    circuit_breaker_threshold: 5,
    timeout_seconds: 30
  };
  
  // Initialize form
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      batch_size: extractionSettings.batch_size || 100,
      max_retries: extractionSettings.max_retries || 3,
      throttle_delay_ms: extractionSettings.throttle_delay_ms || 1000,
      circuit_breaker_threshold: extractionSettings.circuit_breaker_threshold || 5,
      timeout_seconds: extractionSettings.timeout_seconds || 30,
      refresh_frequency: dataset.refresh_frequency as any || "none",
      auto_refresh_enabled: dataset.refresh_frequency !== null
    }
  });
  
  const onSubmit = async (values: SettingsFormValues) => {
    setSaving(true);
    
    try {
      // Update extraction settings
      const extractionSettings = {
        batch_size: values.batch_size,
        max_retries: values.max_retries,
        throttle_delay_ms: values.throttle_delay_ms,
        circuit_breaker_threshold: values.circuit_breaker_threshold,
        timeout_seconds: values.timeout_seconds
      };
      
      // Prepare update data
      const updateData: any = {
        extraction_settings: extractionSettings
      };
      
      // Only set refresh_frequency if auto-refresh is enabled
      if (values.auto_refresh_enabled) {
        updateData.refresh_frequency = values.refresh_frequency;
        
        // Calculate next run time based on frequency
        const now = new Date();
        if (values.refresh_frequency === 'daily') {
          now.setDate(now.getDate() + 1);
          now.setHours(0, 0, 0, 0);
        } else if (values.refresh_frequency === 'weekly') {
          now.setDate(now.getDate() + (7 - now.getDay()));
          now.setHours(0, 0, 0, 0);
        } else if (values.refresh_frequency === 'monthly') {
          now.setMonth(now.getMonth() + 1);
          now.setDate(1);
          now.setHours(0, 0, 0, 0);
        }
        
        updateData.next_scheduled_run = now.toISOString();
      } else {
        updateData.refresh_frequency = null;
        updateData.next_scheduled_run = null;
      }
      
      const { error } = await supabase
        .from('datasets')
        .update(updateData)
        .eq('id', dataset.id);
        
      if (error) throw error;
      
      toast({
        title: "Settings updated",
        description: "Your dataset settings have been updated successfully."
      });
      
      // Refresh dataset data
      onUpdate();
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        variant: "destructive",
        title: "Failed to update settings",
        description: "There was an error updating your dataset settings."
      });
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dataset Settings</CardTitle>
        <CardDescription>
          Configure extraction settings and scheduling
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-base font-semibold mb-3">Extraction Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="batch_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Size</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>
                        Number of records per API call (10-250)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="max_retries"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Retries</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>
                        Maximum retry attempts for failed API calls
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="throttle_delay_ms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Throttle Delay (ms)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>
                        Delay between API calls (milliseconds)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="circuit_breaker_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Circuit Breaker Threshold</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>
                        Consecutive failures before stopping extraction
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="timeout_seconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeout (seconds)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>
                        API call timeout in seconds
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <div>
              <h3 className="text-base font-semibold mb-3">Scheduling</h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="auto_refresh_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Automatic Refresh</FormLabel>
                        <FormDescription>
                          Enable automatic scheduled extractions
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                {form.watch('auto_refresh_enabled') && (
                  <FormField
                    control={form.control}
                    name="refresh_frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Refresh Frequency</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How often to refresh the dataset
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export default DatasetSettings;
