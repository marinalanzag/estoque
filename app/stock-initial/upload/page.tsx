import StockInitialUploadForm from "@/components/uploads/StockInitialUploadForm";
import { getActivePeriod } from "@/lib/periods";

export default async function StockInitialUploadPage() {
  const activePeriod = await getActivePeriod();
  
  return <StockInitialUploadForm activePeriodId={activePeriod?.id || null} />;
}

