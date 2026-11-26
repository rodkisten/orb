import type { Metadata } from "next";
import { DesignShowcase } from "@/components/design-showcase";

export const metadata: Metadata = {
  title: "Design System — shadcn/ui e Radix UI",
  description:
    "Catálogo interativo de componentes shadcn/ui e primitivas Radix UI personalizadas.",
};

export default function DesignPage() {
  return <DesignShowcase />;
}
