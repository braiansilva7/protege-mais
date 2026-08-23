import verticalNavigation from '@/navigation/vertical';
import type { NavigationItem } from '@/navigation/vertical';

// Mantém a mesma origem de verdade para itens e permissões nos dois layouts.
const horizontalNavigation: NavigationItem[] = verticalNavigation.map(
  (item) => ({
    ...item,
    permissions: item.permissions ? [...item.permissions] : undefined,
  })
);

export default horizontalNavigation;
