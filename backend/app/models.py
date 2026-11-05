from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

EVENT_STATUSES = ["confirmed", "production", "completed", "invoiced", "paid", "archived"]

LEAD_KINDS = ["lead", "quote"]
LEAD_STATUSES = {
    "lead": ["new", "contacted", "won", "lost"],
    "quote": ["draft", "sent", "accepted", "declined"],
}
RECIPE_SOURCES = ["user", "builtin", "imported"]
SCALING_MODELS = ["servings", "per_person", "batch"]
INGREDIENT_CATEGORIES = [
    "produce", "meat", "dairy", "bakery", "pantry", "spices", "frozen", "other",
]

CURRENCIES = ["ILS"]  # ש"ח בלבד

EVENT_TYPES = [
    "wedding", "birthday", "corporate", "dinner", "holiday", "bbq", "other",
]


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    total_guests: Mapped[int] = mapped_column(Integer)
    buffer_percent: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
    other_costs: Mapped[float] = mapped_column(Float, default=0.0)
    tax_percent: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="ILS")
    event_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    agreed_price: Mapped[float] = mapped_column(Float, default=0.0)
    deposit_paid: Mapped[float] = mapped_column(Float, default=0.0)
    invoice_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    invoice_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    client: Mapped["Client | None"] = relationship(back_populates="events")
    segments: Mapped[list["GuestSegment"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    menu_items: Mapped[list["EventMenuItem"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    prep_tasks: Mapped[list["PrepTask"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    lead: Mapped["Lead | None"] = relationship(back_populates="event")


class GuestSegment(Base):
    __tablename__ = "guest_segments"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    name: Mapped[str] = mapped_column(String(100))
    guest_count: Mapped[int] = mapped_column(Integer)
    restrictions: Mapped[list] = mapped_column(JSON, default=list)

    event: Mapped["Event"] = relationship(back_populates="segments")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cuisine: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="user")
    scaling_model: Mapped[str] = mapped_column(String(20), default="servings")
    base_servings: Mapped[int | None] = mapped_column(Integer, nullable=True)
    people_per_batch: Mapped[int | None] = mapped_column(Integer, nullable=True)
    allergens: Mapped[list] = mapped_column(JSON, default=list)
    prep_time_min: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan"
    )


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    default_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cost_per_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    density: Mapped[float | None] = mapped_column(Float, nullable=True)  # g per 1 mL
    currency: Mapped[str] = mapped_column(String(3), default="ILS")
    aisle: Mapped[str | None] = mapped_column(String(100), nullable=True)
    substitution_group: Mapped[str | None] = mapped_column(String(100), nullable=True)

    recipe_links: Mapped[list["RecipeIngredient"]] = relationship(back_populates="ingredient")
    nutrition: Mapped["Nutrition | None"] = relationship(
        back_populates="ingredient", uselist=False, cascade="all, delete-orphan"
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"))
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"))
    quantity: Mapped[float] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)

    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")
    ingredient: Mapped["Ingredient"] = relationship(back_populates="recipe_links")


class EventMenuItem(Base):
    __tablename__ = "event_menu_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"))
    segment_id: Mapped[int | None] = mapped_column(ForeignKey("guest_segments.id"), nullable=True)
    portions_per_guest: Mapped[int] = mapped_column(Integer, default=1)

    event: Mapped["Event"] = relationship(back_populates="menu_items")
    recipe: Mapped["Recipe"] = relationship()
    segment: Mapped["GuestSegment"] = relationship()


class PrepTask(Base):
    __tablename__ = "prep_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    prep_min: Mapped[int] = mapped_column(Integer, default=0)
    due_offset_hours: Mapped[int] = mapped_column(Integer, default=0)
    done: Mapped[bool] = mapped_column(Boolean, default=False)

    event: Mapped["Event"] = relationship(back_populates="prep_tasks")


class Nutrition(Base):
    __tablename__ = "nutrition"

    id: Mapped[int] = mapped_column(primary_key=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"), unique=True)
    calories: Mapped[float] = mapped_column(Float, default=0.0)  # per 100 g/mL
    protein_g: Mapped[float] = mapped_column(Float, default=0.0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0.0)
    fat_g: Mapped[float] = mapped_column(Float, default=0.0)
    sodium_mg: Mapped[float] = mapped_column(Float, default=0.0)
    sugar_g: Mapped[float] = mapped_column(Float, default=0.0)
    reference_unit: Mapped[str] = mapped_column(String(10), default="100g")  # "100g" | "100ml"

    ingredient: Mapped["Ingredient"] = relationship(back_populates="nutrition")


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict | list | str | float | int | bool] = mapped_column(JSON)


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(10))

    events: Mapped[list["Event"]] = relationship(back_populates="client")
    leads: Mapped[list["Lead"]] = relationship(back_populates="client")


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(10), default="lead")  # 'lead' | 'quote'
    title: Mapped[str] = mapped_column(String(200))
    event_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preferred_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    guest_estimate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="new")
    converted_event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(10))

    client: Mapped["Client | None"] = relationship(back_populates="leads")
    event: Mapped["Event | None"] = relationship(back_populates="lead")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    amount: Mapped[float] = mapped_column(Float)
    date: Mapped[str] = mapped_column(String(10))
    method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    event: Mapped["Event"] = relationship(back_populates="payments")


class PriceBook(Base):
    __tablename__ = "price_book"

    id: Mapped[int] = mapped_column(primary_key=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"))
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price_per_unit: Mapped[float] = mapped_column(Float)
    effective_date: Mapped[str] = mapped_column(String(10))
    supplier: Mapped[str | None] = mapped_column(String(200), nullable=True)

    ingredient: Mapped["Ingredient"] = relationship()


class PantryHolding(Base):
    __tablename__ = "pantry_holdings"

    id: Mapped[int] = mapped_column(primary_key=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"), unique=True)
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    updated_at: Mapped[str] = mapped_column(String(10))

    ingredient: Mapped["Ingredient"] = relationship()


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hourly_rate: Mapped[float] = mapped_column(Float, default=0.0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(10))


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    provider: Mapped[str | None] = mapped_column(String(120), nullable=True)
    parent_agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id"), nullable=True)
    capabilities: Mapped[list] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    key_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[str] = mapped_column(String(25))
    last_seen_at: Mapped[str | None] = mapped_column(String(25), nullable=True)

    updates: Mapped[list["AgentUpdate"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )


class AgentUpdate(Base):
    __tablename__ = "agent_updates"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40), default="insight")
    severity: Mapped[str] = mapped_column(String(20), default="info")
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    href: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String(25))

    agent: Mapped["Agent"] = relationship(back_populates="updates")
