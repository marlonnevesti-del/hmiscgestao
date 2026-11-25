export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      clinical_counters: {
        Row: {
          kind: string
          value: number
        }
        Insert: {
          kind: string
          value?: number
        }
        Update: {
          kind?: string
          value?: number
        }
        Relationships: []
      }
      clinical_state: {
        Row: {
          data: Json
          id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      clinical_state_history: {
        Row: {
          appointment_count: number
          data: Json
          encounter_count: number
          id: string
          patient_count: number
          reason: string
          saved_at: string
          saved_by: string | null
          state_id: string
          version: number
        }
        Insert: {
          appointment_count?: number
          data: Json
          encounter_count?: number
          id?: string
          patient_count?: number
          reason?: string
          saved_at?: string
          saved_by?: string | null
          state_id?: string
          version: number
        }
        Update: {
          appointment_count?: number
          data?: Json
          encounter_count?: number
          id?: string
          patient_count?: number
          reason?: string
          saved_at?: string
          saved_by?: string | null
          state_id?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_areas: string[] | null
          address: string
          approved_at: string | null
          approved_by: string | null
          birth_date: string
          council_number: string
          council_state: string
          council_type: string
          cpf: string
          created_at: string
          email: string
          full_name: string
          id: string
          job_function: string
          phone: string
          status: string
          username: string
        }
        Insert: {
          access_areas?: string[] | null
          address?: string
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string
          council_number?: string
          council_state?: string
          council_type?: string
          cpf?: string
          created_at?: string
          email?: string
          full_name?: string
          id: string
          job_function?: string
          phone?: string
          status?: string
          username?: string
        }
        Update: {
          access_areas?: string[] | null
          address?: string
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string
          council_number?: string
          council_state?: string
          council_type?: string
          cpf?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_function?: string
          phone?: string
          status?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      grant_administrator: { Args: { target_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_employee: { Args: { _user_id: string }; Returns: boolean }
      next_clinical_number: {
        Args: { _kind: string; _min?: number }
        Returns: number
      }
      remove_employee_access: {
        Args: { target_id: string }
        Returns: undefined
      }
      restore_clinical_state_snapshot: {
        Args: { _history_id: string }
        Returns: number
      }
      review_employee: {
        Args: { new_status: string; target_id: string }
        Returns: undefined
      }
      set_employee_areas: {
        Args: { areas: string[]; target_id: string }
        Returns: undefined
      }
      set_employee_function: {
        Args: { new_function: string; target_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "employee"],
    },
  },
} as const
