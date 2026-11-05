from __future__ import annotations

from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict


class ImportLine(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, allow_inf_nan=False)
    ingredient: str = Field(min_length=1, max_length=200)
    quantity: float = Field(gt=0)
    unit: Optional[str] = Field(default=None, max_length=50)


class ImportConfirm(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    ingredients: List[ImportLine] = Field(min_length=1, max_length=500)


class EventBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    date: str = Field(min_length=10, max_length=10, pattern=r"^\d{4}-\d{2}-\d{2}$")
    location: Optional[str] = None
    client_id: Optional[int] = None
    total_guests: int = Field(ge=1)
    buffer_percent: float = Field(default=0.0, ge=0, le=100)
    other_costs: float = Field(default=0.0, ge=0)
    tax_percent: float = Field(default=0.0, ge=0, le=100)
    currency: str = "ILS"
    event_type: Optional[str] = None
    agreed_price: float = Field(default=0.0, ge=0)
    deposit_paid: float = Field(default=0.0, ge=0)
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    notes: Optional[str] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    date: Optional[str] = Field(default=None, min_length=10, max_length=10, pattern=r"^\d{4}-\d{2}-\d{2}$")
    location: Optional[str] = None
    total_guests: Optional[int] = Field(default=None, ge=1)
    buffer_percent: Optional[float] = Field(default=None, ge=0, le=100)
    status: Optional[str] = None
    other_costs: Optional[float] = Field(default=None, ge=0)
    tax_percent: Optional[float] = Field(default=None, ge=0, le=100)
    currency: Optional[str] = None
    event_type: Optional[str] = None
    client_id: Optional[int] = None
    agreed_price: Optional[float] = Field(default=None, ge=0)
    deposit_paid: Optional[float] = Field(default=None, ge=0)
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    notes: Optional[str] = None


class SegmentCreate(BaseModel):
    name: str
    guest_count: int = Field(ge=0)
    restrictions: List[str] = []


class SegmentUpdate(BaseModel):
    name: Optional[str] = None
    guest_count: Optional[int] = Field(default=None, ge=0)
    restrictions: Optional[List[str]] = None


class MenuItemCreate(BaseModel):
    recipe_id: int
    segment_id: Optional[int] = None
    portions_per_guest: int = Field(default=1, ge=1)


class MenuItemUpdate(BaseModel):
    recipe_id: Optional[int] = None
    segment_id: Optional[int] = None
    portions_per_guest: Optional[int] = Field(default=None, ge=1)


class IngredientBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: Optional[str] = None
    aliases: List[str] = []
    default_unit: Optional[str] = None
    cost_per_unit: Optional[float] = Field(default=None, ge=0)
    density: Optional[float] = Field(default=None, gt=0)
    currency: str = "ILS"
    aisle: Optional[str] = None
    substitution_group: Optional[str] = None


class IngredientCreate(IngredientBase):
    pass


class IngredientUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    aliases: Optional[List[str]] = None
    default_unit: Optional[str] = None
    cost_per_unit: Optional[float] = Field(default=None, ge=0)
    density: Optional[float] = Field(default=None, gt=0)
    currency: Optional[str] = None
    aisle: Optional[str] = None
    substitution_group: Optional[str] = None


class RecipeIngredientItem(BaseModel):
    ingredient_id: int
    quantity: float
    unit: Optional[str] = None


class RecipeBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    cuisine: Optional[str] = None
    source: str = "user"
    scaling_model: str = "servings"
    base_servings: Optional[int] = Field(default=None, gt=0)
    people_per_batch: Optional[int] = Field(default=None, gt=0)
    allergens: List[str] = []
    prep_time_min: int = Field(default=0, ge=0)
    notes: Optional[str] = None
    ingredients: List[RecipeIngredientItem] = []


class RecipeCreate(RecipeBase):
    pass


class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    cuisine: Optional[str] = None
    source: Optional[str] = None
    scaling_model: Optional[str] = None
    base_servings: Optional[int] = Field(default=None, gt=0)
    people_per_batch: Optional[int] = Field(default=None, gt=0)
    allergens: Optional[List[str]] = None
    prep_time_min: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None
    ingredients: Optional[List[RecipeIngredientItem]] = None


class PrepTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    prep_min: int = Field(default=0, ge=0)
    due_offset_hours: int = Field(default=0, ge=0)
    done: bool = False


class PrepTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    prep_min: Optional[int] = Field(default=None, ge=0)
    due_offset_hours: Optional[int] = Field(default=None, ge=0)
    done: Optional[bool] = None


class ImportParseResponse(BaseModel):
    name: str
    ingredients: list


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    hourly_rate: float = Field(default=0.0, ge=0)
    active: bool = True
    notes: Optional[str] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    hourly_rate: Optional[float] = Field(default=None, ge=0)
    active: Optional[bool] = None
    notes: Optional[str] = None


class LeadCreate(BaseModel):
    client_id: Optional[int] = None
    kind: str = "lead"
    title: str = Field(min_length=1, max_length=200)
    event_type: Optional[str] = None
    preferred_date: Optional[str] = None
    guest_estimate: Optional[int] = Field(default=None, ge=0)
    amount: float = Field(default=0.0, ge=0)
    status: str = "new"
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    client_id: Optional[int] = None
    kind: Optional[str] = None
    title: Optional[str] = None
    event_type: Optional[str] = None
    preferred_date: Optional[str] = None
    guest_estimate: Optional[int] = Field(default=None, ge=0)
    amount: Optional[float] = Field(default=None, ge=0)
    status: Optional[str] = None
    converted_event_id: Optional[int] = None
    notes: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    date: str
    method: Optional[str] = None
    notes: Optional[str] = None


class PriceBookCreate(BaseModel):
    unit: Optional[str] = None
    price_per_unit: float = Field(gt=0)
    effective_date: str
    supplier: Optional[str] = None


class AgentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=3, max_length=80, pattern=r"^[a-z0-9][a-z0-9-]*$")
    provider: Optional[str] = Field(default=None, max_length=120)
    parent_agent_id: Optional[int] = Field(default=None, gt=0)
    capabilities: List[str] = Field(default_factory=list, max_length=12)


class AgentConfigUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    provider: Optional[str] = Field(default=None, max_length=120)
    parent_agent_id: Optional[int] = Field(default=None, gt=0)
    capabilities: Optional[List[str]] = Field(default=None, max_length=12)
    active: Optional[bool] = None


class AgentInsightCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    kind: str = Field(default="insight", min_length=1, max_length=40)
    severity: str = Field(default="info", min_length=1, max_length=20)
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=2000)
    href: Optional[str] = Field(default=None, max_length=300)
    payload: dict = Field(default_factory=dict)


class AgentInsightUpdate(BaseModel):
    status: str = Field(pattern=r"^(new|acknowledged|resolved)$")


class TelegramSettingsUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    bot_token: Optional[str] = Field(default=None, min_length=20, max_length=200)
    chat_id: Optional[str] = Field(default=None, min_length=1, max_length=80)
    enabled: bool = False
