export default function BrandLogo({
  className = "",
  priority = "eager",
}: {
  className?: string;
  priority?: "eager" | "lazy";
}) {
  return (
    // The logo is intentionally kept as a plain image so its original wordmark
    // and mark remain pixel-accurate on every screen and in printed reports.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/africinnovate_logo.png"
      alt="Africinnovate"
      width={415}
      height={118}
      loading={priority}
      className={`h-auto w-auto object-contain ${className}`}
    />
  );
}
