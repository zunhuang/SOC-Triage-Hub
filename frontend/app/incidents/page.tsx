"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IncidentsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/soc-triage");
  }, [router]);
  return null;
}
