export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      api_metrics: {
        Row: {
          created_at: string
          execution_time_ms: number
          id: string
          operation_type: string
          rate_limit_available: number | null
          rate_limit_maximum: number | null
          request_id: string | null
          request_size: number | null
          response_size: number | null
          source_id: string
          status_code: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          execution_time_ms: number
          id?: string
          operation_type: string
          rate_limit_available?: number | null
          rate_limit_maximum?: number | null
          request_id?: string | null
          request_size?: number | null
          response_size?: number | null
          source_id: string
          status_code?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          execution_time_ms?: number
          id?: string
          operation_type?: string
          rate_limit_available?: number | null
          rate_limit_maximum?: number | null
          request_id?: string | null
          request_size?: number | null
          response_size?: number | null
          source_id?: string
          status_code?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_metrics_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      api_schemas: {
        Row: {
          api_version: string
          cache_valid_until: string
          created_at: string
          id: string
          schema: Json
          schema_hash: string
          source_id: string
          updated_at: string
        }
        Insert: {
          api_version: string
          cache_valid_until: string
          created_at?: string
          id?: string
          schema: Json
          schema_hash: string
          source_id: string
          updated_at?: string
        }
        Update: {
          api_version?: string
          cache_valid_until?: string
          created_at?: string
          id?: string
          schema?: Json
          schema_hash?: string
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_schemas_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      dataset_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          query_details: Json | null
          query_name: string
          query_type: Database["public"]["Enums"]["query_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          query_details?: Json | null
          query_name: string
          query_type: Database["public"]["Enums"]["query_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          query_details?: Json | null
          query_name?: string
          query_type?: Database["public"]["Enums"]["query_type"]
          updated_at?: string
        }
        Relationships: []
      }
      datasets: {
        Row: {
          created_at: string
          data: Json | null
          data_updated_at: string | null
          description: string | null
          error_message: string | null
          extraction_priority: number | null
          extraction_progress: number | null
          extraction_settings: Json | null
          id: string
          is_template: boolean | null
          last_completed_run: string | null
          last_error_details: Json | null
          last_run_duration: number | null
          name: string
          next_scheduled_run: string | null
          query_details: Json | null
          query_name: string
          query_type: Database["public"]["Enums"]["query_type"]
          record_count: number | null
          refresh_frequency: string | null
          secure_query_validation: boolean | null
          source_id: string
          status: string | null
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          data_updated_at?: string | null
          description?: string | null
          error_message?: string | null
          extraction_priority?: number | null
          extraction_progress?: number | null
          extraction_settings?: Json | null
          id?: string
          is_template?: boolean | null
          last_completed_run?: string | null
          last_error_details?: Json | null
          last_run_duration?: number | null
          name: string
          next_scheduled_run?: string | null
          query_details?: Json | null
          query_name: string
          query_type: Database["public"]["Enums"]["query_type"]
          record_count?: number | null
          refresh_frequency?: string | null
          secure_query_validation?: boolean | null
          source_id: string
          status?: string | null
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          data_updated_at?: string | null
          description?: string | null
          error_message?: string | null
          extraction_priority?: number | null
          extraction_progress?: number | null
          extraction_settings?: Json | null
          id?: string
          is_template?: boolean | null
          last_completed_run?: string | null
          last_error_details?: Json | null
          last_run_duration?: number | null
          name?: string
          next_scheduled_run?: string | null
          query_details?: Json | null
          query_name?: string
          query_type?: Database["public"]["Enums"]["query_type"]
          record_count?: number | null
          refresh_frequency?: string | null
          secure_query_validation?: boolean | null
          source_id?: string
          status?: string | null
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datasets_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datasets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dataset_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_logs: {
        Row: {
          api_calls: number | null
          average_response_time: number | null
          created_at: string
          dataset_id: string
          end_time: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          records_processed: number | null
          start_time: string
          status: string
          total_records: number | null
          updated_at: string
        }
        Insert: {
          api_calls?: number | null
          average_response_time?: number | null
          created_at?: string
          dataset_id: string
          end_time?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          records_processed?: number | null
          start_time?: string
          status?: string
          total_records?: number | null
          updated_at?: string
        }
        Update: {
          api_calls?: number | null
          average_response_time?: number | null
          created_at?: string
          dataset_id?: string
          end_time?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          records_processed?: number | null
          start_time?: string
          status?: string
          total_records?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_logs_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      locks: {
        Row: {
          acquired_at: string
          expires_at: string
          lock_id: string
          lock_key: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          lock_id: string
          lock_key: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          lock_id?: string
          lock_key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      schema_diffs: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          diff_details: Json
          id: string
          new_api_version: string
          old_api_version: string
          severity: string
          source_id: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          diff_details: Json
          id?: string
          new_api_version: string
          old_api_version: string
          severity: string
          source_id: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          diff_details?: Json
          id?: string
          new_api_version?: string
          old_api_version?: string
          severity?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schema_diffs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          access_token: string | null
          api_version: string | null
          client_id: string | null
          connection_error: string | null
          connection_status:
            | Database["public"]["Enums"]["connection_status"]
            | null
          created_at: string
          description: string | null
          id: string
          last_connected_at: string | null
          metadata: Json | null
          name: string
          rate_limit_rules: Json | null
          store_name: string | null
          type: Database["public"]["Enums"]["source_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          api_version?: string | null
          client_id?: string | null
          connection_error?: string | null
          connection_status?:
            | Database["public"]["Enums"]["connection_status"]
            | null
          created_at?: string
          description?: string | null
          id?: string
          last_connected_at?: string | null
          metadata?: Json | null
          name: string
          rate_limit_rules?: Json | null
          store_name?: string | null
          type: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          api_version?: string | null
          client_id?: string | null
          connection_error?: string | null
          connection_status?:
            | Database["public"]["Enums"]["connection_status"]
            | null
          created_at?: string
          description?: string | null
          id?: string
          last_connected_at?: string | null
          metadata?: Json | null
          name?: string
          rate_limit_rules?: Json | null
          store_name?: string | null
          type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clean_expired_locks: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_locks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      decrypt_access_token: {
        Args: {
          encrypted_token: string
          user_uuid: string
        }
        Returns: string
      }
      decrypt_value: {
        Args: {
          encrypted_value: string
        }
        Returns: string
      }
      encrypt_value: {
        Args: {
          value: string
        }
        Returns: string
      }
      extend_lock: {
        Args: {
          p_key: string
          p_ttl_seconds?: number
        }
        Returns: boolean
      }
      get_decrypted_source_token: {
        Args: {
          source_id: string
        }
        Returns: string
      }
      is_authenticated: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      release_lock: {
        Args: {
          p_key: string
        }
        Returns: boolean
      }
      try_acquire_lock: {
        Args: {
          p_key: string
          p_lock_id: string
          p_ttl_seconds?: number
        }
        Returns: boolean
      }
    }
    Enums: {
      connection_status: "connected" | "disconnected" | "error"
      query_type:
        | "product"
        | "order"
        | "customer"
        | "inventory"
        | "collection"
        | "custom"
      source_type: "shopify" | "amazon" | "ebay" | "etsy" | "woocommerce"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
