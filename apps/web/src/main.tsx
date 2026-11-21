import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider, createRootRoute, createRoute, Outlet, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { EventExplorer } from './pages/events'
import './styles.css'

const searchSchema = z.object({
  project: z.string().catch('all'),
  source: z.string().catch(''),
  type: z.string().catch(''),
  status: z.enum(['all', 'pending', 'queued', 'processed', 'failed']).catch('all'),
  sort: z.enum(['newest', 'oldest']).catch('newest'),
  limit: z.coerce.number().int().min(1).max(100).catch(25),
  page: z.coerce.number().int().min(1).catch(1),
  view: z.enum(['table', 'cards']).catch('table'),
  panel: z.enum(['open', 'closed']).catch('closed'),
  selected: z.string().catch(''),
})

const root = createRootRoute({ component: () => <div className="app"><header><Link to="/" className="brand">🪐 orb</Link><nav><Link to="/events" search={{}} activeProps={{ className: 'active' }}>Events</Link></nav></header><main><Outlet /></main></div> })
const home = createRoute({ getParentRoute: () => root, path: '/', component: () => <section className="intro"><p className="eyebrow">AUTOMATION CONTROL PLANE</p><h1>Everything in orbit.</h1><p>Event streams, workflows and connected systems. Navigate to the event explorer to inspect your activity.</p><Link to="/events" search={{}}>Explore events →</Link></section> })
const events = createRoute({ getParentRoute: () => root, path: '/events', validateSearch: searchSchema, component: EventExplorer })
const routeTree = root.addChildren([home, events])
const router = createRouter({ routeTree, defaultPreload: 'intent' })
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></React.StrictMode>)
