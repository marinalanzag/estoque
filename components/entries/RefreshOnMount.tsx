"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RefreshOnMount() {
  const router = useRouter();

  useEffect(() => {
    // Forçar refresh quando o componente é montado (usuário volta para a página)
    router.refresh();
  }, [router]);

  return null;
}









