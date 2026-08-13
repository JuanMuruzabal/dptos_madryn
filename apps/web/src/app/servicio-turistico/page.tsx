import { ComingSoon } from "@/components/coming-soon";
import { getCategory } from "@/lib/categories";

export default function ServicioTuristicoPage() {
  return (
    <ComingSoon
      title="Servicio Turístico"
      description="Excursiones de día completo a Península Valdés, avistaje de ballenas y más — el listado de excursiones complejas llega en la próxima etapa. ¿Buscás algo más simple? Mirá Experiencias."
      gradient={getCategory("servicio-turistico").scene.gradient}
    />
  );
}
