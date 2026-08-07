import { CartView } from "@/app/(app)/cart/cart-view";
import { PageHeader } from "@/components/page-header";

export default function CartPage() {
  return (
    <>
      <PageHeader
        title="Cart"
        description="What to buy. Tick things off as you shop, then move them into your kitchen in one go."
      />
      <CartView />
    </>
  );
}
