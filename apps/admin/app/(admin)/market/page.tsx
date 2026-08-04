import { MarketItemsManager } from "@/components/market-items-manager";
import { PageHeader } from "@/components/admin-static";
import { listMarketItems } from "@/lib/services/market-items";

export default async function MarketPage() {
  const { items, error } = await listMarketItems();

  return (
    <div className="page-stack">
      <PageHeader
        title="素材市场"
        description="管理插画生成页「素材市场」展示的参考素材，web 端按分类读取上架素材。"
      />
      <MarketItemsManager initialItems={items} loadError={error} />
    </div>
  );
}
