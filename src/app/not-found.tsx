export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf4e8] px-6 text-center text-[#4f5942]">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.42em] text-[#7b8467]">404</p>
        <h1 className="font-[Georgia,'Times_New_Roman',serif] text-4xl sm:text-5xl">
          Page not found
        </h1>
        <p className="text-base sm:text-lg">
          The page you requested is unavailable.
        </p>
      </div>
    </main>
  );
}
