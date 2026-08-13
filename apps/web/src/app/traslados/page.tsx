import { ComingSoon } from "@/components/coming-soon";
import { getCategory } from "@/lib/categories";

export default function TrasladosPage() {
  return (
    <ComingSoon
      title="Traslado al aeropuerto"
      description="El formulario de reserva de traslados está en camino. Mientras tanto, contactanos directamente para coordinar tu movilidad."
      gradient={getCategory("traslados").scene.gradient}
    />
  );
}
