import { useMediaQuery } from '@mantine/hooks';

export type ViewportTier = 'desktop' | 'tablet' | 'mobile';

export function useHelixViewport(): ViewportTier {
  const isDesktop = useMediaQuery('(min-width: 1024px)') ?? true;
  const isTablet = useMediaQuery('(min-width: 768px)') ?? true;
  if (isDesktop) return 'desktop';
  if (isTablet) return 'tablet';
  return 'mobile';
}
