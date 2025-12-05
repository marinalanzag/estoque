import SpedUploadForm from "@/components/uploads/SpedUploadForm";
import { getActivePeriod } from "@/lib/periods";

export default async function SpedUploadPage() {
  const activePeriod = await getActivePeriod();
  
  return <SpedUploadForm activePeriodId={activePeriod?.id || null} />;
}

