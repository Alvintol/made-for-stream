import { useTheme } from "../../providers/ThemeProvider";

// The Made for Stream logo in the colours for the site's theme (public/brand,
// docs/rebranding.md). `compact` shows only the M on phones and the full logo
// from 640px up; the <picture> means a browser downloads just the one it shows.
const BrandLogo = ({ compact = false, className }: { compact?: boolean; className?: string }) => {
  const { theme } = useTheme();
  const logo = `/brand/logo-${theme}.svg`;

  if (!compact) {
    return (
      <img src={logo} alt="Made for Stream" width={1700} height={494} className={className} draggable={false} />
    );
  }

  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={logo} width={1700} height={494} />
      <img
        src={`/brand/mark-${theme}.svg`}
        alt="Made for Stream"
        width={562}
        height={562}
        className={className}
        draggable={false}
      />
    </picture>
  );
};

export default BrandLogo;
