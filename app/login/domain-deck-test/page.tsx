import { notFound } from "next/navigation";
import { DomainDeckPlayground } from "./playground";

export const dynamic = "force-dynamic";

export default function DomainDeckTestPage() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") notFound();
  return <DomainDeckPlayground />;
}
