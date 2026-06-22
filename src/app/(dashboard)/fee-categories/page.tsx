import { Metadata } from "next";
import { FeeCategoryClientPage } from "./client-page";

export const metadata: Metadata = {
  title: "Fee Categories | School ERP",
  description: "Manage fee categories and master data",
};

export default function FeeCategoriesPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <FeeCategoryClientPage />
    </div>
  );
}
