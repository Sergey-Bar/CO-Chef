export interface Allergen {
  key: string
  label: string
}

export interface IngredientNutrition {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sodium_mg: number
  sugar_g: number
  reference_unit: string
}

export interface Ingredient {
  id: number
  name: string
  category: string | null
  aliases: string[]
  default_unit: string | null
  cost_per_unit: number | null
  density: number | null
  currency: string
  aisle: string | null
  substitution_group: string | null
  nutrition?: IngredientNutrition | null
}

export interface RecipeIngredient {
  id: number
  recipe_id: number
  ingredient_id: number
  quantity: number
  unit: string | null
  ingredient_name?: string | null
}

export interface Recipe {
  id: number
  name: string
  description: string | null
  category: string | null
  cuisine: string | null
  source: 'user' | 'builtin' | 'imported'
  scaling_model: 'servings' | 'per_person' | 'batch'
  base_servings: number | null
  people_per_batch: number | null
  allergens: string[]
  prep_time_min: number
  notes: string | null
  ingredients: RecipeIngredient[]
}

export interface GuestSegment {
  id: number
  event_id: number
  name: string
  guest_count: number
  restrictions: string[]
}

export interface ClientSummary {
  client_id: number
  jobs_count: number
  revenue: number
  outstanding: number
  last_job_date: string | null
}

export interface Client {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  summary?: ClientSummary
}

export interface Employee {
  id: number
  name: string
  role: string | null
  phone: string | null
  email: string | null
  hourly_rate: number
  active: boolean
  notes: string | null
  created_at: string
}

export interface Lead {
  id: number
  client_id: number | null
  kind: 'lead' | 'quote'
  title: string
  event_type: string | null
  preferred_date: string | null
  guest_estimate: number | null
  amount: number
  status: string
  converted_event_id: number | null
  notes: string | null
  created_at: string
  client_name?: string | null
}

export interface Payment {
  id: number
  event_id: number
  amount: number
  date: string
  method: string | null
  notes: string | null
}

export interface PriceBookEntry {
  id: number
  ingredient_id: number
  unit: string | null
  price_per_unit: number
  effective_date: string
  supplier: string | null
}

export interface EventMenuItem {
  id: number
  event_id: number
  recipe_id: number
  segment_id: number | null
  portions_per_guest: number
  recipe_name?: string | null
  segment_name?: string | null
}

export interface PrepTask {
  id: number
  event_id: number
  title: string
  description: string | null
  prep_min: number
  due_offset_hours: number
  done: boolean
}

export type EventStatus = 'confirmed' | 'production' | 'completed' | 'invoiced' | 'paid' | 'archived'

export interface Event {
  id: number
  name: string
  date: string
  location: string | null
  client_id: number | null
  client?: Client | null
  total_guests: number
  buffer_percent: number
  status: EventStatus
  other_costs: number
  tax_percent: number
  currency: string
  event_type: string | null
  agreed_price: number
  deposit_paid: number
  invoice_number: string | null
  invoice_date: string | null
  paid_total: number
  balance: number
  notes: string | null
  segments: GuestSegment[]
  menu_items: EventMenuItem[]
  prep_tasks: PrepTask[]
  payments: Payment[]
}

export interface ShoppingLine {
  ingredient_id: number
  name: string
  category: string | null
  unit: string | null
  qty_before_buffer: number
  qty_after_buffer: number
  display: { text: string; unit?: string; rounded_up: boolean }
  flags: string[]
  menu_items: string[]
  cost: number | null
  cost_ok: boolean
}

export interface CostTotals {
  ingredient_subtotal: number
  other_costs: number
  tax: number
  tax_percent: number
  total: number
}

export interface AllergenReportSegment {
  segment_id: number
  segment_name: string
  guest_count: number
  restrictions: string[]
  flagged_items: {
    menu_item_id: number
    recipe_id: number
    recipe_name: string
    allergens: string[]
  }[]
}

export interface PrepSuggestion {
  title: string
  description: string
  due_offset_hours: number
  prep_min: number
}

export interface NutritionSummary {
  totals: Record<string, number>
  per_portion: Record<string, number>
  per_dish: { recipe_id: number; recipe_name: string; portions: number; nutrition: Record<string, number> }[]
  missing_nutrition: string[]
}

export interface EventPlan {
  event_id: number
  shopping_list: ShoppingLine[]
  costs: CostTotals
  allergen_report: AllergenReportSegment[]
  nutrition: NutritionSummary
  buffer_percent: number
  prep_suggestions: PrepSuggestion[]
}

export interface SubstitutionSuggestion {
  ingredient_id: number
  name: string
  reason: string
  group: boolean
}

export interface IngredientSubstitutions {
  ingredient_id: number
  name: string
  substitutions: SubstitutionSuggestion[]
}

export interface SmartMenuSuggestion {
  recipe_id: number
  name: string
  cuisine: string | null
  category: string | null
  cost: number
  score: number
  reasons: string[]
}

export interface SmartMenuResult {
  event_id: number
  currency: string
  suggestions: SmartMenuSuggestion[]
  total_cost: number
  budget: number | null
  within_budget: boolean
  month: number | null
}

export interface MetaData {
  currencies: string[]
  event_types: string[]
  allergens: Allergen[]
}

export interface FinanceMonthPoint {
  month: string
  revenue: number
  cost: number
}

export interface FinanceEventRow {
  event_id: number
  status: string
  revenue: number
  cogs: number
  other_costs: number
  tax: number
  total_cost: number
  net: number
  margin: number | null
  balance: number
  estimate_complete: boolean
  missing_price_lines: number
}

export interface FinanceSummary {
  currency: string
  completed_net: number
  projected_net: number
  incomplete_estimates: number
  period: string
  revenue: number
  cogs: number
  other_costs: number
  tax: number
  total_cost: number
  net: number
  margin: number | null
  receivables: number
  collected: number
  pipeline_value: number
  jobs_count: number
  monthly: FinanceMonthPoint[]
  by_event: FinanceEventRow[]
}

export interface WorkloadDay {
  date: string
  jobs: number
  prep_hours: number
}

export interface UpcomingJob {
  event_id: number
  name: string
  date: string
  client_name: string | null
  guests: number
  status: string
  prep_hours: number
}

export interface WorkSummary {
  pipeline_counts: Record<string, number>
  next_event: {
    event_id: number; name: string; date: string
    client_name: string | null; guests: number; prep_hours: number; status: string
  } | null
  workload: WorkloadDay[]
  upcoming_events: UpcomingJob[]
  actions: {
    open_quotes: { count: number; value: number }
    new_leads: { count: number }
    unpaid_invoices: { count: number; total: number }
  }
}

export interface HomeSummary {
  work: WorkSummary
  finance_month: FinanceSummary
  briefing: BusinessBriefing
  insights: HomeInsights
  agent_updates: AgentUpdate[]
}

export interface HomeInsights {
  future_events: number
  earned_to_date: number
  low_stock_count: number
  price_increases: { name: string; change_percent: number }[]
  price_decreases: { name: string; change_percent: number }[]
  menu_missing: { id: number; name: string; date: string }[]
}

export interface BriefingAction {
  key: string
  severity: 'urgent' | 'warning' | 'opportunity' | 'info'
  title: string
  detail: string
  label: string
  href: string
  event_id: number | null
  event_name: string | null
  event_date: string | null
}

export interface BusinessBriefing {
  generated_for: string
  summary: {
    urgent: number
    warnings: number
    opportunities: number
    ready_events: number
    events_checked: number
  }
  primary: BriefingAction | null
  actions: BriefingAction[]
}

export interface Agent {
  id: number
  slug: string
  name: string
  provider: string | null
  parent_agent_id: number | null
  capabilities: string[]
  active: boolean
  created_at: string | null
  last_seen_at: string | null
  is_builtin: boolean
  access_key?: string
}

export interface AgentUpdate {
  id: number
  agent_id: number
  agent_name: string
  agent_slug: string | null
  kind: string
  severity: 'urgent' | 'warning' | 'opportunity' | 'info'
  title: string
  summary: string
  href: string | null
  status: 'new' | 'acknowledged' | 'resolved'
  payload: Record<string, unknown>
  created_at: string
}

export interface PantryHolding {
  id: number
  ingredient_id: number
  name: string | null
  category: string | null
  quantity: number
  unit: string | null
  updated_at: string
}

export interface PrepTaskItem {
  title: string
  recipe_name: string
  prep_min: number
  due_offset_hours: number
}

export interface PrepDay {
  day: number
  label: string
  tasks: PrepTaskItem[]
  hours: number
}

export interface PrepPlan {
  event_id: number
  total_min: number
  total_hours: number
  max_due_offset_hours: number
  recommended_start_date: string | null
  days: PrepDay[]
  tasks: PrepTaskItem[]
}

export interface EventReadiness {
  event_id: number
  name: string
  date: string
  status: string
  finance: FinanceEventRow
  menu_count: number
  shopping_lines: number
  shopping_cost: number
  missing_prices: string[]
  prep: PrepPlan
  allergen_warnings: number
  nutrition_calories: number
}

export interface TelegramSettings {
  configured: boolean
  chat_id: string
  enabled: boolean
}

export interface UploadImportResult {
  filename: string
  kind: string
  text_preview: string
  text: string
  classification: IntakeClassification
  parsed: ParsedImport | null
}

export interface ParsedImportLine {
  raw: string
  ok: boolean
  error?: string
  quantity?: number
  unit?: string | null
  ingredient?: string
}

export interface ParsedImport {
  name: string
  ingredients: ParsedImportLine[]
}

export interface IntakeClassification {
  kind: 'recipe' | 'event' | 'client' | 'inventory' | 'note'
  label: string
  confidence: number
  title: string
  fields: { date: string | null; guests: number | null; email: string | null; phone: string | null; amount: number | null; line_count: number }
}
