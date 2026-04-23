const ASPECT = 1600 / 1155;

export default function BrandMark({
  size = 32,
  className = ''
}: {
  size?: number;
  className?: string;
}) {
  const height = size;
  const width = Math.round(size * ASPECT);
  return (
    <img
      src="/mascot.png"
      width={width}
      height={height}
      alt=""
      className={`brandmark rounded-2xl ring-1 ring-white/10 ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
