// Next.js envuelve automáticamente page.tsx en <Suspense fallback={<Loading/>}>
// para esta ruta. /perfil es inherentemente dinámica (lee la cookie de
// sesión y llama a apps/api) — este esqueleto es lo único que puede
// prerenderizarse como "shell" (ver next.config.ts cacheComponents).
export default function PerfilLoading() {
  return (
    <main className="flex-1 bg-sand px-6 pt-32 pb-24 md:px-10">
      <div className="mx-auto max-w-(--container-max) animate-pulse">
        <div className="h-3 w-24 rounded bg-ink/10" />
        <div className="mt-4 h-10 w-64 rounded bg-ink/10" />
        <div className="mt-10 h-24 w-full max-w-md rounded bg-ink/10" />
      </div>
    </main>
  );
}
