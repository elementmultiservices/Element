
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"ip": unknown,"metadata": NonNullable<Json>,"target_id": string | null,"target_type": string | null,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"ip"?: unknown,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string | null,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"ip"?: unknown,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string | null,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"contact_messages": {
                  Row: {
                    "created_at": string,"email": string,"handled_at": string | null,"handled_by": string | null,"id": string,"is_handled": boolean,"locale": Database["public"]['Enums']["app_locale"],"message": string,"name": string,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"is_handled"?: boolean,"locale"?: Database["public"]['Enums']["app_locale"],"message": string,"name": string,"subject": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"is_handled"?: boolean,"locale"?: Database["public"]['Enums']["app_locale"],"message"?: string,"name"?: string,"subject"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_messages_handled_by_fkey"
      columns: ["handled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"file_categories": {
                  Row: {
                    "created_at": string,"id": string,"is_archived": boolean,"name_en": string,"name_es": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_archived"?: boolean,"name_en": string,"name_es": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_archived"?: boolean,"name_en"?: string,"name_es"?: string
                  }
                  Relationships: [
                    
                  ]
                },"files": {
                  Row: {
                    "category_id": string | null,"checksum_sha256": string,"created_at": string,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"id": string,"mime_type": string,"original_name": string,"owner_id": string,"size_bytes": number,"storage_path": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"checksum_sha256": string,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"id"?: string,"mime_type": string,"original_name": string,"owner_id": string,"size_bytes": number,"storage_path": string,"uploaded_by": string
                  }
                  Update: {
                    "category_id"?: string | null,"checksum_sha256"?: string,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"id"?: string,"mime_type"?: string,"original_name"?: string,"owner_id"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "files_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "file_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "files_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "files_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "files_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"intake_submissions": {
                  Row: {
                    "created_at": string,"data": NonNullable<Json>,"filing_status": string,"id": string,"locale": Database["public"]['Enums']["app_locale"],"owner_id": string | null,"contact_email": string | null,"draft_id": string | null,"face_photo_path": string | null,"assigned_by": string | null,"assigned_at": string | null,"pub135_acknowledged": boolean,"agreement_accepted": boolean,"reviewed_at": string | null,"reviewed_by": string | null,"signature_method": string,"spouse_signature_method": string | null,"signature_path": string,"signed_at": string,"signer_ip": unknown,"signer_name": string,"signer_user_agent": string | null,"spouse_signature_path": string | null,"spouse_signer_name": string | null,"status": string,"tax_year": number,"taxpayer_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data": NonNullable<Json>,"filing_status": string,"id"?: string,"locale"?: Database["public"]['Enums']["app_locale"],"owner_id"?: string | null,"contact_email"?: string | null,"draft_id"?: string | null,"face_photo_path"?: string | null,"assigned_by"?: string | null,"assigned_at"?: string | null,"pub135_acknowledged"?: boolean,"agreement_accepted"?: boolean,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"signature_method"?: string,"spouse_signature_method"?: string | null,"signature_path": string,"signed_at"?: string,"signer_ip"?: unknown,"signer_name": string,"signer_user_agent"?: string | null,"spouse_signature_path"?: string | null,"spouse_signer_name"?: string | null,"status"?: string,"tax_year": number,"taxpayer_name": string
                  }
                  Update: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"filing_status"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["app_locale"],"owner_id"?: string | null,"contact_email"?: string | null,"draft_id"?: string | null,"face_photo_path"?: string | null,"assigned_by"?: string | null,"assigned_at"?: string | null,"pub135_acknowledged"?: boolean,"agreement_accepted"?: boolean,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"signature_method"?: string,"spouse_signature_method"?: string | null,"signature_path"?: string,"signed_at"?: string,"signer_ip"?: unknown,"signer_name"?: string,"signer_user_agent"?: string | null,"spouse_signature_path"?: string | null,"spouse_signer_name"?: string | null,"status"?: string,"tax_year"?: number,"taxpayer_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "intake_submissions_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "intake_submissions_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "intake_submissions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"intake_uploads": {
                  Row: {
                    "checksum_sha256": string | null,"created_at": string,"doc_type": string,"expires_at": string,"id": string,"mime_type": string,"original_name": string,"owner_id": string | null,"draft_id": string | null,"size_bytes": number,"storage_path": string,"submission_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "checksum_sha256"?: string | null,"created_at"?: string,"doc_type": string,"expires_at": string,"id"?: string,"mime_type": string,"original_name": string,"owner_id"?: string | null,"draft_id"?: string | null,"size_bytes": number,"storage_path": string,"submission_id"?: string | null
                  }
                  Update: {
                    "checksum_sha256"?: string | null,"created_at"?: string,"doc_type"?: string,"expires_at"?: string,"id"?: string,"mime_type"?: string,"original_name"?: string,"owner_id"?: string | null,"draft_id"?: string | null,"size_bytes"?: number,"storage_path"?: string,"submission_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "intake_uploads_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "intake_uploads_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "intake_submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"mfa_recovery_codes": {
                  Row: {
                    "code_hash": string,"created_at": string,"id": string,"used_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code_hash": string,"created_at"?: string,"id"?: string,"used_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "code_hash"?: string,"created_at"?: string,"id"?: string,"used_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mfa_recovery_codes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"newsletter_sends": {
                  Row: {
                    "created_at": string,"failed": number,"id": string,"recipients": number,"sent_by": string | null,"title": string,"update_slug": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "title": string,"created_at"?: string,"failed"?: number,"id"?: string,"recipients"?: number,"sent_by"?: string | null,"update_slug"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"failed"?: number,"id"?: string,"recipients"?: number,"sent_by"?: string | null,"title"?: string,"update_slug"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "newsletter_sends_sent_by_fkey"
      columns: ["sent_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"newsletter_subscribers": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"locale": Database["public"]['Enums']["app_locale"],"source": string,"unsubscribe_token": string,"unsubscribed_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string,"created_at"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["app_locale"],"source"?: string,"unsubscribe_token"?: string,"unsubscribed_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["app_locale"],"source"?: string,"unsubscribe_token"?: string,"unsubscribed_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                  ]
                },"site_settings": {
                  Row: {
                    "address": string,"announcement_enabled": boolean,"announcement_label_en": string,"announcement_label_es": string,"announcement_text_en": string,"announcement_text_es": string,"booking_url": string,"email": string,"hours_regular_en": string,"hours_regular_es": string,"hours_season_en": string,"hours_season_es": string,"id": boolean,"maps_url": string,"phone": string,"updated_at": string,"updated_by": string | null,"whatsapp": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string,"announcement_enabled"?: boolean,"announcement_label_en"?: string,"announcement_label_es"?: string,"announcement_text_en"?: string,"announcement_text_es"?: string,"booking_url"?: string,"email"?: string,"hours_regular_en"?: string,"hours_regular_es"?: string,"hours_season_en"?: string,"hours_season_es"?: string,"id"?: boolean,"maps_url"?: string,"phone"?: string,"updated_at"?: string,"updated_by"?: string | null,"whatsapp"?: string
                  }
                  Update: {
                    "address"?: string,"announcement_enabled"?: boolean,"announcement_label_en"?: string,"announcement_label_es"?: string,"announcement_text_en"?: string,"announcement_text_es"?: string,"booking_url"?: string,"email"?: string,"hours_regular_en"?: string,"hours_regular_es"?: string,"hours_season_en"?: string,"hours_season_es"?: string,"id"?: boolean,"maps_url"?: string,"phone"?: string,"updated_at"?: string,"updated_by"?: string | null,"whatsapp"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "can_upload": boolean,"created_at": string,"full_name": string,"id": string,"id_last4": string | null,"is_active": boolean,"preferred_locale": Database["public"]['Enums']["app_locale"],"role": Database["public"]['Enums']["user_role"],"storage_quota_bytes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "can_upload"?: boolean,"created_at"?: string,"full_name"?: string,"id": string,"id_last4"?: string | null,"is_active"?: boolean,"preferred_locale"?: Database["public"]['Enums']["app_locale"],"role"?: Database["public"]['Enums']["user_role"],"storage_quota_bytes"?: number
                  }
                  Update: {
                    "can_upload"?: boolean,"created_at"?: string,"full_name"?: string,"id"?: string,"id_last4"?: string | null,"is_active"?: boolean,"preferred_locale"?: Database["public"]['Enums']["app_locale"],"role"?: Database["public"]['Enums']["user_role"],"storage_quota_bytes"?: number
                  }
                  Relationships: [
                    
                  ]
                },"upload_grants": {
                  Row: {
                    "created_at": string,"email": string,"granted_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"granted_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"granted_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "upload_grants_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"upload_intents": {
                  Row: {
                    "category_id": string | null,"consumed_at": string | null,"created_at": string,"declared_mime": string,"declared_size": number,"description": string | null,"expires_at": string,"id": string,"original_name": string,"owner_id": string,"requested_by": string,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"consumed_at"?: string | null,"created_at"?: string,"declared_mime": string,"declared_size": number,"description"?: string | null,"expires_at": string,"id"?: string,"original_name": string,"owner_id": string,"requested_by": string,"storage_path": string
                  }
                  Update: {
                    "category_id"?: string | null,"consumed_at"?: string | null,"created_at"?: string,"declared_mime"?: string,"declared_size"?: number,"description"?: string | null,"expires_at"?: string,"id"?: string,"original_name"?: string,"owner_id"?: string,"requested_by"?: string,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "upload_intents_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "file_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "upload_intents_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "upload_intents_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_list_categories":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"file_count": number,"id": string,"is_archived": boolean,"name_en": string,"name_es": string
            }[]
                           },
"admin_list_users":
{ Args: { "p_dir"?: string,"p_id"?: string,"p_limit"?: number,"p_offset"?: number,"p_role"?: string,"p_search"?: string,"p_sort"?: string,"p_status"?: string,"p_upload"?: string }; Returns: {
              "can_upload": boolean,"created_at": string,"email": string,"file_count": number,"full_name": string,"has_mfa": boolean,"id": string,"id_last4": string,"invitation_pending": boolean,"is_active": boolean,"last_sign_in_at": string,"preferred_locale": Database["public"]['Enums']["app_locale"],"role": Database["public"]['Enums']["user_role"],"storage_quota_bytes": number,"total_count": number,"used_bytes": number
            }[]
                           },
"admin_overview":
{ Args: Record<PropertyKey, never>; Returns: {
              "files_active": number,"files_trashed": number,"storage_trashed_bytes": number,"storage_used_bytes": number,"uploads_last_7d": number,"users_active": number,"users_inactive": number,"users_pending": number,"users_total": number
            }[]
                           },
"admin_search_audit":
{ Args: { "p_action"?: string,"p_actor"?: string,"p_from"?: string,"p_limit"?: number,"p_offset"?: number,"p_q"?: string,"p_subject"?: string,"p_to"?: string }; Returns: {
              "action": string,"actor_email": string,"actor_id": string,"actor_name": string,"created_at": string,"id": number,"ip": unknown,"metadata": Json,"target_id": string,"target_label": string,"target_type": string,"total_count": number,"user_agent": string
            }[]
                           },
"admin_user_labels":
{ Args: { "p_ids": (string)[] }; Returns: {
              "email": string,"full_name": string,"id": string
            }[]
                           },
"admin_user_options":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"full_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["user_role"]
            }[]
                           },
"auth_user_id_by_email":
{ Args: { "p_email": string }; Returns: string
                           },
"consume_recovery_code":
{ Args: { "p_hash": string,"p_user": string }; Returns: boolean
                           },
"current_session_valid":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"invoke_purge_trash":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"is_active_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"like_escape":
{ Args: { "p": string }; Returns: string
                           },
"my_auth_activity":
{ Args: { "p_limit"?: number }; Returns: {
              "action": string,"created_at": string,"id": number,"ip": unknown,"user_agent": string
            }[]
                           },
"my_has_password":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_recovery_codes_remaining":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"revoke_user_sessions":
{ Args: { "p_user": string }; Returns: undefined
                           },
"session_context":
{ Args: Record<PropertyKey, never>; Returns: {
              "can_upload": boolean,"full_name": string,"has_verified_mfa": boolean,"is_active": boolean,"preferred_locale": Database["public"]['Enums']["app_locale"],"role": Database["public"]['Enums']["user_role"],"session_valid": boolean
            }[]
                           },
"storage_usage":
{ Args: { "p_owner": string }; Returns: {
              "pending_bytes": number,"quota_bytes": number,"used_bytes": number
            }[]
                           }
          }
          Enums: {
            "app_locale": "en"|"es","user_role": "user"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_locale": ["en", "es"],"user_role": ["user", "admin"]
          }
        }
} as const
