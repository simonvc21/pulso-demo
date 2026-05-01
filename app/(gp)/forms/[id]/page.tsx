import { redirect } from "next/navigation";

export default function FormDetailPage() {
  // Demo: route to the builder for editing
  redirect("/forms/new");
}
