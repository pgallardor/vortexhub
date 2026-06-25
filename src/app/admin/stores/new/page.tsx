import { StoreForm } from "@/components/admin/store-form";
import { PageHeader } from "@/components/frontend";

export default function NewStorePage() {
  return (
    <>
      <PageHeader
        eyebrow="Onboarding"
        title="Registra tu tienda"
        description="Crea la identidad base de la tienda. Después podrás subir logo, agregar sucursales y publicar eventos."
      />
      <StoreForm />
    </>
  );
}
