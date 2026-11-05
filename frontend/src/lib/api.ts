import type {
  Event, EventPlan, Ingredient, ParsedImport, PrepTask, PrepSuggestion, Recipe, Allergen, GuestSegment, EventMenuItem,
  IngredientSubstitutions, SmartMenuResult, MetaData, Client, ClientSummary, Lead, Payment, PriceBookEntry,
  Employee,
  FinanceSummary, WorkSummary, HomeSummary, PantryHolding, EventReadiness, PrepPlan,
  UploadImportResult, IntakeClassification, Agent, AgentUpdate, TelegramSettings,
} from './types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && options?.body instanceof FormData
  const headers = new Headers(options?.headers)
  if (!isForm && options?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  let res: Response
  try {
    res = await fetch(path, {
    ...options,
    headers,
    signal: options?.signal ?? AbortSignal.timeout(30000),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('הבקשה ארכה זמן רב מדי. בדקו את מצב הפעולה לפני ניסיון נוסף.')
    }
    if (error instanceof TypeError) throw new Error('לא ניתן להתחבר לשרת. ודאו שהאפליקציה פועלת ונסו שוב.')
    throw error
  }
  if (!res.ok) {
    let message = `הבקשה נכשלה (${res.status})`
    try {
      const body = await res.json()
      if (body.detail) message = typeof body.detail === 'string' ? body.detail : message
      if (Array.isArray(body.detail)) message = body.detail.map((issue: { loc?: string[]; msg?: string }) => `${issue.loc?.slice(1).join('.') ?? ''}: ${issue.msg ?? ''}`).join('; ')
    } catch { /* ignore */ }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  // events
  events: (status?: string) =>
    request<Event[]>(`/api/events${status ? `?status=${status}` : ''}`),
  event: (id: number) => request<Event>(`/api/events/${id}`),
  createEvent: (data: Partial<Event>) =>
    request<Event>('/api/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id: number, data: Partial<Event>) =>
    request<Event>(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: (id: number) => request<void>(`/api/events/${id}`, { method: 'DELETE' }),
  plan: (id: number) => request<EventPlan>(`/api/events/${id}/plan`),

  // segments
  replaceSegments: (eventId: number, segments: Partial<GuestSegment>[]) =>
    request<GuestSegment[]>(`/api/events/${eventId}/segments`, {
      method: 'PUT', body: JSON.stringify(segments),
    }),
  addSegment: (eventId: number, data: Partial<GuestSegment>) =>
    request<GuestSegment>(`/api/events/${eventId}/segments`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  updateSegment: (id: number, data: Partial<GuestSegment>) =>
    request<GuestSegment>(`/api/segments/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  deleteSegment: (id: number) => request<void>(`/api/segments/${id}`, { method: 'DELETE' }),

  // menu items
  addMenuItem: (eventId: number, data: Partial<EventMenuItem>) =>
    request<EventMenuItem>(`/api/events/${eventId}/menu-items`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  updateMenuItem: (id: number, data: Partial<EventMenuItem>) =>
    request<EventMenuItem>(`/api/menu-items/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  deleteMenuItem: (id: number) => request<void>(`/api/menu-items/${id}`, { method: 'DELETE' }),

  // recipes
  recipes: () => request<Recipe[]>('/api/recipes'),
  recipe: (id: number) => request<Recipe>(`/api/recipes/${id}`),
  createRecipe: (data: Partial<Recipe>) =>
    request<Recipe>('/api/recipes', { method: 'POST', body: JSON.stringify(data) }),
  updateRecipe: (id: number, data: Partial<Recipe>) =>
    request<Recipe>(`/api/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecipe: (id: number) => request<void>(`/api/recipes/${id}`, { method: 'DELETE' }),

  // ingredients
  ingredients: () => request<Ingredient[]>('/api/ingredients'),
  createIngredient: (data: Partial<Ingredient>) =>
    request<Ingredient>('/api/ingredients', { method: 'POST', body: JSON.stringify(data) }),
  updateIngredient: (id: number, data: Partial<Ingredient>) =>
    request<Ingredient>(`/api/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIngredient: (id: number) =>
    request<void>(`/api/ingredients/${id}`, { method: 'DELETE' }),
  allergens: () => request<Allergen[]>('/api/allergens'),
  meta: () => request<MetaData>('/api/meta'),
  settings: () => request<Record<string, unknown>>('/api/settings'),
  saveSettings: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  telegramSettings: () => request<TelegramSettings>('/api/integrations/telegram'),
  saveTelegramSettings: (data: { bot_token?: string; chat_id?: string; enabled: boolean }) =>
    request<TelegramSettings>('/api/integrations/telegram', { method: 'PUT', body: JSON.stringify(data) }),
  testTelegram: () => request<{ ok: boolean }>('/api/integrations/telegram/test', { method: 'POST' }),
  sendEventTelegramBrief: (eventId: number) => request<{ ok: boolean }>(`/api/events/${eventId}/telegram-brief`, { method: 'POST' }),
  substitutions: (ingredientId: number) =>
    request<IngredientSubstitutions>(`/api/ingredients/${ingredientId}/substitutions`),

  // smart menu
  suggestMenu: (eventId: number, data?: {
    budget?: number; preferred_cuisine?: string; course_count?: number
  }) => request<SmartMenuResult>(`/api/events/${eventId}/menu/suggest`, {
    method: 'POST', body: JSON.stringify(data ?? {}),
  }),

  // clients
  clients: () => request<(Client & { summary: ClientSummary })[]>('/api/clients'),
  createClient: (data: Partial<Client>) =>
    request<Client>('/api/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: number, data: Partial<Client>) =>
    request<Client>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: number) => request<void>(`/api/clients/${id}`, { method: 'DELETE' }),
  clientSummary: (id: number) => request<ClientSummary>(`/api/clients/${id}/summary`),

  // employees
  employees: () => request<Employee[]>('/api/employees'),
  createEmployee: (data: Partial<Employee>) =>
    request<Employee>('/api/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: number, data: Partial<Employee>) =>
    request<Employee>(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployee: (id: number) => request<void>(`/api/employees/${id}`, { method: 'DELETE' }),

  // leads / quotes
  leads: () => request<Lead[]>('/api/leads'),
  createLead: (data: Partial<Lead>) =>
    request<Lead>('/api/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id: number, data: Partial<Lead>) =>
    request<Lead>(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  convertLead: (id: number) => request<Event>(`/api/leads/${id}/convert`, { method: 'POST' }),
  deleteLead: (id: number) => request<void>(`/api/leads/${id}`, { method: 'DELETE' }),

  // payments
  addPayment: (eventId: number, data: { amount: number; date: string; method?: string }) =>
    request<Payment>(`/api/events/${eventId}/payments`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  deletePayment: (id: number) => request<void>(`/api/payments/${id}`, { method: 'DELETE' }),

  // price book
  priceBook: (ingredientId: number) =>
    request<PriceBookEntry[]>(`/api/ingredients/${ingredientId}/price-book`),
  addPriceBook: (ingredientId: number, data: Partial<PriceBookEntry>) =>
    request<PriceBookEntry>(`/api/ingredients/${ingredientId}/price-book`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  deletePriceBook: (id: number) => request<void>(`/api/price-book/${id}`, { method: 'DELETE' }),

  // dashboards
  financeSummary: (period = 'all') =>
    request<FinanceSummary>(`/api/finance/summary?period=${period}`),
  workSummary: () => request<WorkSummary>('/api/work/summary'),
  homeSummary: () => request<HomeSummary>('/api/home/summary'),

  // agent hub
  agents: () => request<Agent[]>('/api/agents'),
  createAgent: (data: { name: string; slug: string; provider?: string | null; parent_agent_id?: number | null; capabilities?: string[] }) =>
    request<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: number, data: Partial<Pick<Agent, 'name' | 'provider' | 'parent_agent_id' | 'capabilities' | 'active'>>) =>
    request<Agent>(`/api/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  rotateAgentKey: (id: number) => request<Agent>(`/api/agents/${id}/rotate-key`, { method: 'POST' }),
  agentUpdates: (status?: string) => request<AgentUpdate[]>(`/api/agent-updates${status ? `?status=${status}` : ''}`),
  updateAgentUpdate: (id: number, status: AgentUpdate['status']) =>
    request<AgentUpdate>(`/api/agent-updates/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // pantry
  pantry: () => request<PantryHolding[]>('/api/pantry'),
  setPantry: (ingredientId: number, data: { quantity: number; unit?: string }) =>
    request<PantryHolding>(`/api/pantry/${ingredientId}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  clearPantry: (ingredientId: number) =>
    request<void>(`/api/pantry/${ingredientId}`, { method: 'DELETE' }),

  // readiness / prep
  readiness: (eventId: number) => request<EventReadiness>(`/api/events/${eventId}/readiness`),
  prepPlan: (eventId: number) => request<PrepPlan>(`/api/events/${eventId}/prep-plan`),

  // import
  parseImport: (text: string) =>
    request<ParsedImport>('/api/import/parse', { method: 'POST', body: JSON.stringify({ text }) }),
  classifyImport: (text: string) =>
    request<IntakeClassification>('/api/import/classify', { method: 'POST', body: JSON.stringify({ text }) }),
  confirmImport: (data: { name: string; ingredients: { ingredient: string; quantity: number; unit?: string | null }[] }) =>
    request<Recipe>('/api/import/confirm', { method: 'POST', body: JSON.stringify(data) }),
  uploadImport: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return request<UploadImportResult>('/api/import/upload', { method: 'POST', body: fd })
  },

  // prep tasks
  prepTasks: (eventId: number) => request<PrepTask[]>(`/api/events/${eventId}/prep-tasks`),
  addPrepTask: (eventId: number, data: Partial<PrepTask>) =>
    request<PrepTask>(`/api/events/${eventId}/prep-tasks`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  updatePrepTask: (id: number, data: Partial<PrepTask>) =>
    request<PrepTask>(`/api/prep-tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePrepTask: (id: number) => request<void>(`/api/prep-tasks/${id}`, { method: 'DELETE' }),
  suggestPrepTasks: (eventId: number) =>
    request<{ suggestions: PrepSuggestion[] }>(`/api/events/${eventId}/prep-tasks/suggest`, {
      method: 'POST', body: JSON.stringify({}),
    }),

  seed: () => request<{ ok: boolean }>('/api/seed', { method: 'POST' }),
}
