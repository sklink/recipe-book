export type CartItem = {
  id: string;
  ingredientId: string;
  name: string;
  category: string;
  /**
   * Free text, e.g. "2 tbsp + 1 cup". Amounts are concatenated rather than
   * summed: adding "2 tbsp olive oil" to "1 cup olive oil" needs a unit
   * conversion engine that isn't worth building, and the shopper can read.
   */
  amountNote: string | null;
  /** Titles of the recipes that put this in the cart. */
  sources: string[];
  isChecked: boolean;
};

export type CartResponse = {
  items: CartItem[];
};
