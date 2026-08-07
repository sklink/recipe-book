/**
 * Database types for the Supabase schema.
 *
 * Hand-written to match supabase/migrations/20260807000000_initial_schema.sql,
 * in the same shape `supabase gen types typescript` emits. Once the project is
 * linked, regenerate with `npm run db:types` and let the generator own this file.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type ImageStatus = "pending" | "ready" | "failed";
export type RecipeSource = "manual" | "ai" | "imported";
export type CookOutcome = "flopped" | "rough" | "good" | "nailed";
export type MasteryLevel = "untried" | "attempted" | "learning" | "reliable" | "mastered";

export type Database = {
  public: {
    Tables: {
      ingredients: {
        Row: {
          id: string;
          name: string;
          category: string;
          is_staple: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string;
          is_staple?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          is_staple?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ingredient_aliases: {
        Row: {
          id: string;
          ingredient_id: string;
          alias: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ingredient_id: string;
          alias: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ingredient_id?: string;
          alias?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_aliases_ingredient_id_fkey";
            columns: ["ingredient_id"];
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_stock: {
        Row: {
          ingredient_id: string;
          in_stock: boolean;
          updated_at: string;
        };
        Insert: {
          ingredient_id: string;
          in_stock?: boolean;
          updated_at?: string;
        };
        Update: {
          ingredient_id?: string;
          in_stock?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_stock_ingredient_id_fkey";
            columns: ["ingredient_id"];
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          meal_types: MealType[];
          time_minutes: number;
          servings: number | null;
          instructions: Json;
          image_url: string | null;
          image_status: ImageStatus;
          source: RecipeSource;
          source_url: string | null;
          parent_recipe_id: string | null;
          variant_note: string | null;
          is_favourite: boolean;
          mastery_override: MasteryLevel | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          meal_types?: MealType[];
          time_minutes: number;
          servings?: number | null;
          instructions?: Json;
          image_url?: string | null;
          image_status?: ImageStatus;
          source?: RecipeSource;
          source_url?: string | null;
          parent_recipe_id?: string | null;
          variant_note?: string | null;
          is_favourite?: boolean;
          mastery_override?: MasteryLevel | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          meal_types?: MealType[];
          time_minutes?: number;
          servings?: number | null;
          instructions?: Json;
          image_url?: string | null;
          image_status?: ImageStatus;
          source?: RecipeSource;
          source_url?: string | null;
          parent_recipe_id?: string | null;
          variant_note?: string | null;
          is_favourite?: boolean;
          mastery_override?: MasteryLevel | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_parent_recipe_id_fkey";
            columns: ["parent_recipe_id"];
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          ingredient_id: string;
          amount: number | null;
          unit: string | null;
          prep_note: string | null;
          is_optional: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          ingredient_id: string;
          amount?: number | null;
          unit?: string | null;
          prep_note?: string | null;
          is_optional?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          ingredient_id?: string;
          amount?: number | null;
          unit?: string | null;
          prep_note?: string | null;
          is_optional?: boolean;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey";
            columns: ["ingredient_id"];
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          id: string;
          ingredient_id: string;
          amount_note: string | null;
          source_recipe_ids: string[];
          is_checked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          ingredient_id: string;
          amount_note?: string | null;
          source_recipe_ids?: string[];
          is_checked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          ingredient_id?: string;
          amount_note?: string | null;
          source_recipe_ids?: string[];
          is_checked?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_ingredient_id_fkey";
            columns: ["ingredient_id"];
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      cook_logs: {
        Row: {
          id: string;
          recipe_id: string;
          cooked_at: string;
          outcome: CookOutcome;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          cooked_at?: string;
          outcome: CookOutcome;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          cooked_at?: string;
          outcome?: CookOutcome;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cook_logs_recipe_id_fkey";
            columns: ["recipe_id"];
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      cook_outcome: CookOutcome;
      image_status: ImageStatus;
      mastery_level: MasteryLevel;
      meal_type: MealType;
      recipe_source: RecipeSource;
    };
    CompositeTypes: Record<never, never>;
  };
};

/** Convenience aliases for the rows you'll touch most. */
export type IngredientRow = Database["public"]["Tables"]["ingredients"]["Row"];
export type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"];
export type RecipeIngredientRow = Database["public"]["Tables"]["recipe_ingredients"]["Row"];
export type CartItemRow = Database["public"]["Tables"]["cart_items"]["Row"];
export type CookLogRow = Database["public"]["Tables"]["cook_logs"]["Row"];
