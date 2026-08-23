import type { Page } from '@/types/navigation';
import type { PermissionAction } from '@/types/user';

export interface NavigationItem {
  page: Page;
  title: string;
  icon: string;
  permissions?: PermissionAction[];
}

const verticalNavigation: NavigationItem[] = [
  {
    page: 'dashboard',
    title: 'home',
    icon: '⌂',
  },
  {
    page: 'users',
    title: 'users',
    icon: '♙',
    permissions: ['users.view'],
  },
];

export default verticalNavigation;
