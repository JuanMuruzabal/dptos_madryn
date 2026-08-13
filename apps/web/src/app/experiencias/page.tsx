import { ComingSoon } from "@/components/coming-soon";
import { getCategory } from "@/lib/categories";

export default function ExperienciasPage() {
  return (
    <ComingSoon
      title="Experiencias"
      description="Avistaje de ballenas, Península Valdés, Punta Tombo y más — el listado completo de excursiones llega en la próxima etapa."
      gradient={getCategory("experiencias").scene.gradient}
    />
  );
}
