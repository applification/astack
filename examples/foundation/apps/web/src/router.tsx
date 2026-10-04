import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { z } from 'zod';
import { WorkItemsFeature } from './work-items';

const rootRoute = createRootRoute({ component: Outlet });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: z.object({
    status: z.enum(['all', 'open', 'done']).catch('all'),
  }),
  component: function WorkItemsRoute() {
    return <WorkItemsFeature status={indexRoute.useSearch().status} />;
  },
});
export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
});
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
