from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date, datetime
import hashlib
import hmac
from pathlib import Path
import secrets
import tempfile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from .backup import backup_database
from .database import DB_PATH

from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Header
from .static import SPAStaticFiles
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from .database import Base, engine, SessionLocal, get_db, run_migrations
from .models import (
    Event, GuestSegment, Recipe, Ingredient, RecipeIngredient,
    EventMenuItem, PrepTask, Nutrition, Setting, Client, Lead, Payment, PriceBook, PantryHolding,
    Employee, Agent, AgentUpdate,
    EVENT_STATUSES, RECIPE_SOURCES, SCALING_MODELS, CURRENCIES, EVENT_TYPES,
    LEAD_KINDS, LEAD_STATUSES,
)
from . import schemas
from .allergens import CANONICAL_ALLERGENS, is_canonical
from .scaling import validate_segments
from .services.plan import compute_plan, auto_update_status, compute_prep_suggestions
from .services.nutrition import event_nutrition, NUTRIENT_KEYS
from .services.substitutions import get_substitutions
from .services.smart_menu import suggest_menu
from .services.pipeline import can_transition, apply_side_effects, sync_status_from_payments, event_balance
from .services.finance import finance_summary, client_summary
from .services.work import work_summary
from .services.prepplan import prep_plan, event_readiness
from .services.briefing import business_briefing
from .services.telegram import send_message as send_telegram_message
from .services.gamify import profile_summary
from .services.fileimport import extract_text, file_kind, SUPPORTED
from .services.intake import classify_intake
from .import_parser import parse_recipe_text
from .seed import seed_all, seed_nutrition, seed_price_book, find_ingredient_by_alias

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations()
    db = SessionLocal()
    try:
        if db.query(Ingredient).count() == 0:
            seed_all(db)
        else:
            # Backfill nutrition for existing libraries (idempotent).
            seed_nutrition(db)
            seed_price_book(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Private Chef Event Planner", version="1.0.0", lifespan=lifespan)


# ---------- serialization helpers ----------

def seg_dict(s: GuestSegment) -> dict:
    return {
        "id": s.id, "event_id": s.event_id, "name": s.name,
        "guest_count": s.guest_count, "restrictions": s.restrictions or [],
    }


def recipe_dict(r: Recipe) -> dict:
    return {
        "id": r.id, "name": r.name, "description": r.description,
        "category": r.category, "cuisine": r.cuisine, "source": r.source, "scaling_model": r.scaling_model,
        "base_servings": r.base_servings, "people_per_batch": r.people_per_batch,
        "allergens": r.allergens or [], "prep_time_min": r.prep_time_min,
        "notes": r.notes,
        "ingredients": [ri_dict(x) for x in r.ingredients],
    }


def ri_dict(ri: RecipeIngredient) -> dict:
    return {
        "id": ri.id, "recipe_id": ri.recipe_id, "ingredient_id": ri.ingredient_id,
        "quantity": ri.quantity, "unit": ri.unit,
        "ingredient_name": ri.ingredient.name if ri.ingredient else None,
    }


def nutrition_dict(n: Nutrition | None) -> dict | None:
    if n is None:
        return None
    return {
        "calories": n.calories, "protein_g": n.protein_g,
        "carbs_g": n.carbs_g, "fat_g": n.fat_g,
        "sodium_mg": n.sodium_mg, "sugar_g": n.sugar_g,
        "reference_unit": n.reference_unit,
    }


def ingredient_dict(i: Ingredient) -> dict:
    return {
        "id": i.id, "name": i.name, "category": i.category,
        "aliases": i.aliases or [], "default_unit": i.default_unit,
        "cost_per_unit": i.cost_per_unit, "density": i.density,
        "currency": i.currency, "aisle": i.aisle,
        "substitution_group": i.substitution_group,
        "nutrition": nutrition_dict(i.nutrition),
    }


def payment_dict(p: Payment) -> dict:
    return {
        "id": p.id, "event_id": p.event_id, "amount": p.amount,
        "date": p.date, "method": p.method, "notes": p.notes,
    }


def client_dict(c: Client) -> dict:
    return {
        "id": c.id, "name": c.name, "phone": c.phone, "email": c.email,
        "address": c.address, "notes": c.notes, "created_at": c.created_at,
    }


def employee_dict(emp: Employee) -> dict:
    return {
        "id": emp.id, "name": emp.name, "role": emp.role,
        "phone": emp.phone, "email": emp.email, "hourly_rate": emp.hourly_rate,
        "active": emp.active, "notes": emp.notes, "created_at": emp.created_at,
    }


def agent_dict(agent: Agent) -> dict:
    return {
        "id": agent.id, "slug": agent.slug, "name": agent.name,
        "provider": agent.provider, "parent_agent_id": agent.parent_agent_id,
        "capabilities": agent.capabilities or [],
        "active": agent.active, "created_at": agent.created_at,
        "last_seen_at": agent.last_seen_at, "is_builtin": False,
    }


def agent_update_dict(update: AgentUpdate) -> dict:
    return {
        "id": update.id, "agent_id": update.agent_id,
        "agent_name": update.agent.name if update.agent else "סוכן לא מזוהה",
        "agent_slug": update.agent.slug if update.agent else None,
        "kind": update.kind, "severity": update.severity,
        "title": update.title, "summary": update.summary, "href": update.href,
        "status": update.status, "payload": update.payload or {},
        "created_at": update.created_at,
    }


def _new_agent_key() -> tuple[str, str]:
    key = f"ccagent_{secrets.token_urlsafe(30)}"
    return key, hashlib.sha256(key.encode("utf-8")).hexdigest()


def _agent_now() -> str:
    return datetime.now().astimezone().replace(microsecond=0).isoformat()


def lead_dict(l: Lead) -> dict:
    return {
        "id": l.id, "client_id": l.client_id, "kind": l.kind,
        "title": l.title, "event_type": l.event_type, "preferred_date": l.preferred_date,
        "guest_estimate": l.guest_estimate, "amount": l.amount,
        "status": l.status, "converted_event_id": l.converted_event_id,
        "notes": l.notes, "created_at": l.created_at,
        "client_name": l.client.name if l.client else None,
    }


def pricebook_dict(p: PriceBook) -> dict:
    return {
        "id": p.id, "ingredient_id": p.ingredient_id, "unit": p.unit,
        "price_per_unit": p.price_per_unit, "effective_date": p.effective_date,
        "supplier": p.supplier,
    }


def event_dict(e: Event) -> dict:
    paid_total = sum(p.amount for p in e.payments)
    balance = max(0.0, (e.agreed_price or 0.0) - paid_total)
    return {
        "id": e.id, "name": e.name, "date": e.date, "location": e.location,
        "client_id": e.client_id,
        "client": client_dict(e.client) if e.client else None,
        "total_guests": e.total_guests, "buffer_percent": e.buffer_percent,
        "status": e.status, "other_costs": e.other_costs,
        "tax_percent": e.tax_percent,
        "currency": e.currency, "event_type": e.event_type,
        "agreed_price": e.agreed_price or 0.0,
        "deposit_paid": e.deposit_paid or 0.0,
        "invoice_number": e.invoice_number, "invoice_date": e.invoice_date,
        "paid_total": round(paid_total, 2),
        "balance": round(balance, 2),
        "notes": e.notes,
        "segments": [seg_dict(s) for s in e.segments],
        "menu_items": [mi_dict(m) for m in e.menu_items],
        "prep_tasks": [pt_dict(t) for t in e.prep_tasks],
        "payments": [payment_dict(p) for p in e.payments],
    }


def mi_dict(m: EventMenuItem) -> dict:
    return {
        "id": m.id, "event_id": m.event_id, "recipe_id": m.recipe_id,
        "segment_id": m.segment_id, "portions_per_guest": m.portions_per_guest,
        "recipe_name": m.recipe.name if m.recipe else None,
        "segment_name": m.segment.name if m.segment else None,
    }


def pt_dict(t: PrepTask) -> dict:
    return {
        "id": t.id, "event_id": t.event_id, "title": t.title,
        "description": t.description, "prep_min": t.prep_min,
        "due_offset_hours": t.due_offset_hours, "done": t.done,
    }


def _validate_allergens(allergens):
    for a in (allergens or []):
        if not is_canonical(a):
            raise HTTPException(400, f"אלרגן לא מוכר: '{a}'")


def _validate_event_fields(data: dict):
    if "currency" in data and data["currency"] not in CURRENCIES:
        raise HTTPException(400, f"מטבע לא נתמך: '{data['currency']}'")
    if "event_type" in data and data["event_type"] is not None \
            and data["event_type"] not in EVENT_TYPES:
        raise HTTPException(400, f"סוג אירוע לא נתמך: '{data['event_type']}'")


# ---------- event helpers ----------

def _get_event(db, event_id) -> Event:
    e = db.get(Event, event_id)
    if not e:
        raise HTTPException(404, "האירוע לא נמצא")
    return e


# ---------- Events ----------

@app.get("/api/events")
def list_events(status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Event)
    if status:
        q = q.filter(Event.status == status)
    events = q.all()
    for e in events:
        auto_update_status(db, e)
    return [event_dict(e) for e in events]


@app.post("/api/events", status_code=201)
def create_event(payload: schemas.EventCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    _validate_event_fields(data)
    if data.get("client_id") is not None and not db.get(Client, data["client_id"]):
        raise HTTPException(400, "הלקוח לא נמצא")
    e = Event(**data)
    db.add(e)
    db.commit()
    db.refresh(e)
    return event_dict(e)


@app.get("/api/events/{event_id}")
def get_event(event_id: int, db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    auto_update_status(db, e)
    return event_dict(e)


@app.put("/api/events/{event_id}")
def update_event(event_id: int, payload: schemas.EventUpdate, db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data:
        target = data["status"]
        if target not in EVENT_STATUSES:
            raise HTTPException(400, f"סטטוס לא נתמך: '{target}'")
        if not can_transition(e.status, target):
            raise HTTPException(400, f"לא ניתן למעבר מ-'{e.status}' ל-'{target}'")
        err = apply_side_effects(db, e, target)
        if err:
            raise HTTPException(400, err)
    _validate_event_fields(data)
    if "client_id" in data and data["client_id"] is not None:
        if not db.get(Client, data["client_id"]):
            raise HTTPException(400, "הלקוח לא נמצא")
    for k, v in data.items():
        setattr(e, k, v)
    if data.get("status") == "paid":
        e.deposit_paid = event_balance(e)
    # Re-validate segment sum if total or segments changed.
    errs = validate_segments(e.total_guests, e.segments)
    if errs:
        raise HTTPException(400, errs[0])
    db.commit()
    db.refresh(e)
    return event_dict(e)


@app.delete("/api/events/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    db.delete(e)
    db.commit()


@app.get("/api/events/{event_id}/plan")
def get_event_plan(event_id: int, db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    auto_update_status(db, e)
    return compute_plan(db, e)


# ---------- Segments ----------

@app.post("/api/events/{event_id}/segments", status_code=201)
def create_segment(event_id: int, payload: schemas.SegmentCreate,
                   db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    _validate_allergens(payload.restrictions)
    s = GuestSegment(event_id=event_id, **payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return seg_dict(s)


@app.put("/api/events/{event_id}/segments")
def replace_segments(event_id: int, segments: list[schemas.SegmentCreate],
                     db: Session = Depends(get_db)):
    """Atomically replace an event's guest segments (validated against the total)."""
    e = _get_event(db, event_id)
    for seg in segments:
        _validate_allergens(seg.restrictions)
    errs = validate_segments(e.total_guests, list(segments))
    if errs:
        raise HTTPException(400, errs[0])
    for old in e.segments:
        db.delete(old)
    db.flush()
    for seg in segments:
        db.add(GuestSegment(event_id=event_id, **seg.model_dump()))
    db.commit()
    db.refresh(e)
    return [seg_dict(s) for s in e.segments]


@app.put("/api/segments/{segment_id}")
def update_segment(segment_id: int, payload: schemas.SegmentUpdate,
                   db: Session = Depends(get_db)):
    s = db.get(GuestSegment, segment_id)
    if not s:
        raise HTTPException(404, "קבוצת האורחים לא נמצאה")
    data = payload.model_dump(exclude_unset=True)
    if "restrictions" in data:
        _validate_allergens(data["restrictions"])
    for k, v in data.items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return seg_dict(s)


@app.delete("/api/segments/{segment_id}", status_code=204)
def delete_segment(segment_id: int, db: Session = Depends(get_db)):
    s = db.get(GuestSegment, segment_id)
    if not s:
        raise HTTPException(404, "קבוצת האורחים לא נמצאה")
    db.delete(s)
    db.commit()


# ---------- Menu items ----------

@app.post("/api/events/{event_id}/menu-items", status_code=201)
def create_menu_item(event_id: int, payload: schemas.MenuItemCreate,
                     db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    if not db.get(Recipe, payload.recipe_id):
        raise HTTPException(400, "המתכון לא נמצא")
    if payload.segment_id is not None:
        seg = db.get(GuestSegment, payload.segment_id)
        if not seg or seg.event_id != event_id:
            raise HTTPException(400, "קבוצת האורחים לא שייכת לאירוע הזה")
    mi = EventMenuItem(event_id=event_id, **payload.model_dump())
    db.add(mi)
    db.commit()
    return mi_dict(mi)


@app.put("/api/menu-items/{menu_item_id}")
def update_menu_item(menu_item_id: int, payload: schemas.MenuItemUpdate,
                     db: Session = Depends(get_db)):
    mi = db.get(EventMenuItem, menu_item_id)
    if not mi:
        raise HTTPException(404, "המנה לא נמצאה בתפריט")
    data = payload.model_dump(exclude_unset=True)
    if "recipe_id" in data and not db.get(Recipe, data["recipe_id"]):
        raise HTTPException(400, "המתכון לא נמצא")
    if "segment_id" in data and data["segment_id"] is not None:
        seg = db.get(GuestSegment, data["segment_id"])
        if not seg or seg.event_id != mi.event_id:
            raise HTTPException(400, "קבוצת האורחים לא שייכת לאירוע הזה")
    for k, v in data.items():
        setattr(mi, k, v)
    db.commit()
    return mi_dict(mi)


@app.delete("/api/menu-items/{menu_item_id}", status_code=204)
def delete_menu_item(menu_item_id: int, db: Session = Depends(get_db)):
    mi = db.get(EventMenuItem, menu_item_id)
    if not mi:
        raise HTTPException(404, "המנה לא נמצאה בתפריט")
    db.delete(mi)
    db.commit()


# ---------- Recipes ----------

@app.get("/api/recipes")
def list_recipes(category: str | None = None, q: str | None = None,
                 db: Session = Depends(get_db)):
    query = db.query(Recipe)
    if category:
        query = query.filter(Recipe.category == category)
    if q:
        query = query.filter(Recipe.name.ilike(f"%{q}%"))
    return [recipe_dict(r) for r in query.all()]


@app.post("/api/recipes", status_code=201)
def create_recipe(payload: schemas.RecipeCreate, db: Session = Depends(get_db)):
    if payload.scaling_model not in SCALING_MODELS:
        raise HTTPException(400, f"שיטת הכפלה לא נתמכת: '{payload.scaling_model}'")
    if payload.source not in RECIPE_SOURCES:
        raise HTTPException(400, f"מקור מתכון לא נתמך: '{payload.source}'")
    _validate_allergens(payload.allergens)
    data = payload.model_dump()
    ingredients = data.pop("ingredients", [])
    r = Recipe(**data)
    db.add(r)
    db.flush()
    for line in ingredients:
        if not db.get(Ingredient, line["ingredient_id"]):
            db.rollback()
            raise HTTPException(400, "המצרך לא נמצא")
        db.add(RecipeIngredient(recipe_id=r.id, **line))
    db.commit()
    db.refresh(r)
    return recipe_dict(r)


@app.get("/api/recipes/{recipe_id}")
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(404, "המתכון לא נמצא")
    return recipe_dict(r)


@app.put("/api/recipes/{recipe_id}")
def update_recipe(recipe_id: int, payload: schemas.RecipeUpdate,
                  db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(404, "המתכון לא נמצא")
    data = payload.model_dump(exclude_unset=True)
    if "scaling_model" in data and data["scaling_model"] not in SCALING_MODELS:
        raise HTTPException(400, f"שיטת הכפלה לא נתמכת: '{data['scaling_model']}'")
    if "source" in data and data["source"] not in RECIPE_SOURCES:
        raise HTTPException(400, f"מקור מתכון לא נתמך: '{data['source']}'")
    if "allergens" in data:
        _validate_allergens(data["allergens"])
    ingredients = data.pop("ingredients", None)
    for k, v in data.items():
        setattr(r, k, v)
    if ingredients is not None:
        for old in r.ingredients:
            db.delete(old)
        db.flush()
        for line in ingredients:
            if not db.get(Ingredient, line["ingredient_id"]):
                db.rollback()
                raise HTTPException(400, "המצרך לא נמצא")
            db.add(RecipeIngredient(recipe_id=r.id, **line))
    db.commit()
    db.refresh(r)
    return recipe_dict(r)


@app.delete("/api/recipes/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id)
    if not r:
        raise HTTPException(404, "המתכון לא נמצא")
    db.delete(r)
    db.commit()


# ---------- Ingredients ----------

@app.get("/api/ingredients")
def list_ingredients(q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Ingredient)
    if q:
        query = query.filter(Ingredient.name.ilike(f"%{q}%"))
    return [ingredient_dict(i) for i in query.all()]


@app.post("/api/ingredients", status_code=201)
def create_ingredient(payload: schemas.IngredientCreate, db: Session = Depends(get_db)):
    i = Ingredient(**payload.model_dump())
    db.add(i)
    db.commit()
    db.refresh(i)
    return ingredient_dict(i)


@app.put("/api/ingredients/{ingredient_id}")
def update_ingredient(ingredient_id: int, payload: schemas.IngredientUpdate,
                      db: Session = Depends(get_db)):
    i = db.get(Ingredient, ingredient_id)
    if not i:
        raise HTTPException(404, "המצרך לא נמצא")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(i, k, v)
    db.commit()
    db.refresh(i)
    return ingredient_dict(i)


@app.delete("/api/ingredients/{ingredient_id}", status_code=204)
def delete_ingredient(ingredient_id: int, db: Session = Depends(get_db)):
    i = db.get(Ingredient, ingredient_id)
    if not i:
        raise HTTPException(404, "המצרך לא נמצא")
    db.delete(i)
    db.commit()


@app.get("/api/allergens")
def list_allergens():
    return [{"key": k, "label": ALLERGEN_LABELS.get(k, k)} for k in CANONICAL_ALLERGENS]


from .allergens import ALLERGEN_LABELS  # noqa: E402


# ---------- Meta ----------

@app.get("/api/meta")
def get_meta():
    return {
        "currencies": CURRENCIES,
        "event_types": EVENT_TYPES,
        "allergens": [{"key": k, "label": ALLERGEN_LABELS.get(k, k)}
                       for k in CANONICAL_ALLERGENS],
    }


# ---------- Settings ----------

@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    return {s.key: s.value for s in db.query(Setting).all() if not s.key.startswith('telegram_')}


@app.put("/api/settings")
def put_settings(payload: dict, db: Session = Depends(get_db)):
    if any(k.startswith('telegram_') for k in payload):
        raise HTTPException(422, 'יש לעדכן חיבור Telegram במסך החיבור הייעודי')
    for k, v in payload.items():
        s = db.get(Setting, k)
        if s:
            s.value = v
        else:
            db.add(Setting(key=k, value=v))
    db.commit()
    return get_settings(db)


# ---------- Telegram (opt-in local notification channel) ----------

def _setting_value(db: Session, key: str, default=None):
    item = db.get(Setting, key)
    return item.value if item else default


def _save_setting(db: Session, key: str, value):
    item = db.get(Setting, key)
    if item:
        item.value = value
    else:
        db.add(Setting(key=key, value=value))


@app.get("/api/integrations/telegram")
def telegram_settings(db: Session = Depends(get_db)):
    return {
        "configured": bool(_setting_value(db, "telegram_bot_token") and _setting_value(db, "telegram_chat_id")),
        "chat_id": _setting_value(db, "telegram_chat_id", ""),
        "enabled": bool(_setting_value(db, "telegram_enabled", False)),
    }


@app.put("/api/integrations/telegram")
def save_telegram_settings(payload: schemas.TelegramSettingsUpdate, db: Session = Depends(get_db)):
    existing_token = _setting_value(db, "telegram_bot_token", "")
    token = payload.bot_token or existing_token
    if payload.enabled and (not token or not payload.chat_id):
        raise HTTPException(422, "כדי להפעיל Telegram צריך מפתח בוט ומזהה צ׳אט")
    if payload.bot_token:
        _save_setting(db, "telegram_bot_token", payload.bot_token)
    if payload.chat_id is not None:
        _save_setting(db, "telegram_chat_id", payload.chat_id)
    _save_setting(db, "telegram_enabled", payload.enabled)
    db.commit()
    return telegram_settings(db)


@app.post("/api/integrations/telegram/test")
def test_telegram(db: Session = Depends(get_db)):
    token = _setting_value(db, "telegram_bot_token", "")
    chat_id = _setting_value(db, "telegram_chat_id", "")
    if not token or not chat_id:
        raise HTTPException(422, "חסרים מפתח בוט או מזהה צ׳אט")
    try:
        send_telegram_message(token, chat_id, "✅ Co‑Chef מחובר. התראות רווחיות ומוכנות יישלחו רק כשאתם מפעילים אותן.")
    except ValueError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"ok": True}


@app.post("/api/events/{event_id}/telegram-brief")
def send_event_telegram_brief(event_id: int, db: Session = Depends(get_db)):
    """Send an event snapshot only after the chef explicitly presses send."""
    if not _setting_value(db, "telegram_enabled", False):
        raise HTTPException(422, "יש להפעיל תחילה את Telegram בהגדרות")
    token = _setting_value(db, "telegram_bot_token", "")
    chat_id = _setting_value(db, "telegram_chat_id", "")
    if not token or not chat_id:
        raise HTTPException(422, "חסרים מפתח בוט או מזהה צ׳אט")
    event = _get_event(db, event_id)
    readiness = event_readiness(db, event)
    finance = readiness["finance"]
    margin = f"{finance['margin']:.1f}%" if finance.get("margin") is not None else "ממתין לתמחור"
    message = (
        f"👨‍🍳 Co‑Chef | {event.name}\n📅 {event.date} · {event.total_guests} אורחים\n"
        f"💰 מרווח משוער: {margin}\n🧾 מחירים חסרים: {len(readiness['missing_prices'])}\n"
        f"⚠️ אזהרות אלרגנים: {readiness['allergen_warnings']}\n"
        f"✅ הכנות שהושלמו: {sum(task.done for task in event.prep_tasks)}/{len(event.prep_tasks)}"
    )
    try:
        send_telegram_message(token, chat_id, message)
    except ValueError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"ok": True}


# ---------- Open agent hub ----------

@app.get("/api/agents")
def list_agents(db: Session = Depends(get_db)):
    """List built-in local intelligence and every registered external agent."""
    core = {
        "id": 0, "slug": "co-chef-core", "name": "Co‑Chef Core",
        "provider": "מנוע מקומי", "capabilities": ["רווחיות", "מוכנות אירוע", "הכנות"],
        "active": True, "created_at": None, "last_seen_at": _agent_now(), "is_builtin": True,
    }
    external = [agent_dict(a) for a in db.query(Agent).order_by(Agent.name).all()]
    return [core, *external]


@app.post("/api/agents", status_code=201)
def create_agent(payload: schemas.AgentCreate, db: Session = Depends(get_db)):
    if db.query(Agent).filter(Agent.slug == payload.slug).first():
        raise HTTPException(409, "כבר קיים סוכן עם מזהה זה")
    if payload.parent_agent_id is not None and not db.get(Agent, payload.parent_agent_id):
        raise HTTPException(422, "סוכן־המנהל שנבחר לא נמצא")
    key, key_hash = _new_agent_key()
    agent = Agent(
        **payload.model_dump(), key_hash=key_hash, active=True, created_at=_agent_now(),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return {**agent_dict(agent), "access_key": key}


def _ensure_no_agent_cycle(db: Session, agent_id: int, parent_agent_id: int | None):
    """Reject a reporting line that would turn the team structure into a loop."""
    seen: set[int] = set()
    current_id = parent_agent_id
    while current_id is not None:
        if current_id == agent_id:
            raise HTTPException(422, "לא ניתן ליצור מעגל בין סוכנים")
        if current_id in seen:
            raise HTTPException(422, "היררכיית הסוכנים הקיימת מכילה מעגל")
        seen.add(current_id)
        current = db.get(Agent, current_id)
        current_id = current.parent_agent_id if current else None


@app.put("/api/agents/{agent_id}")
def update_agent(agent_id: int, payload: schemas.AgentConfigUpdate, db: Session = Depends(get_db)):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "הסוכן לא נמצא")
    data = payload.model_dump(exclude_unset=True)
    if data.get("parent_agent_id") == agent_id:
        raise HTTPException(422, "סוכן לא יכול לנהל את עצמו")
    if "parent_agent_id" in data and data["parent_agent_id"] is not None and not db.get(Agent, data["parent_agent_id"]):
        raise HTTPException(422, "סוכן־המנהל שנבחר לא נמצא")
    if "parent_agent_id" in data:
        _ensure_no_agent_cycle(db, agent_id, data["parent_agent_id"])
    for key, value in data.items():
        setattr(agent, key, value)
    db.commit()
    db.refresh(agent)
    return agent_dict(agent)


@app.post("/api/agents/{agent_id}/rotate-key")
def rotate_agent_key(agent_id: int, db: Session = Depends(get_db)):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "הסוכן לא נמצא")
    key, key_hash = _new_agent_key()
    agent.key_hash = key_hash
    agent.last_seen_at = None
    db.commit()
    return {**agent_dict(agent), "access_key": key}


@app.get("/api/agent-updates")
def list_agent_updates(limit: int = 20, status: str | None = None, db: Session = Depends(get_db)):
    if limit < 1 or limit > 100:
        raise HTTPException(422, "הגבול חייב להיות בין 1 ל־100")
    query = db.query(AgentUpdate).order_by(AgentUpdate.id.desc())
    if status:
        if status not in ("new", "acknowledged", "resolved"):
            raise HTTPException(422, "סטטוס עדכון לא נתמך")
        query = query.filter(AgentUpdate.status == status)
    return [agent_update_dict(item) for item in query.limit(limit).all()]


@app.post("/api/agents/{agent_id}/updates", status_code=201)
def publish_agent_update(
    agent_id: int,
    payload: schemas.AgentInsightCreate,
    x_cochef_agent_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Provider-neutral, key-authenticated inbox for any local or remote agent."""
    agent = db.get(Agent, agent_id)
    if not agent or not agent.active:
        raise HTTPException(404, "הסוכן לא זמין")
    supplied_hash = hashlib.sha256((x_cochef_agent_key or "").encode("utf-8")).hexdigest()
    if not x_cochef_agent_key or not hmac.compare_digest(agent.key_hash, supplied_hash):
        raise HTTPException(401, "מפתח הסוכן אינו תקין")
    if payload.severity not in ("urgent", "warning", "opportunity", "info"):
        raise HTTPException(422, "דרגת העדיפות אינה נתמכת")
    if payload.href and (not payload.href.startswith("/") or payload.href.startswith("//")):
        raise HTTPException(422, "קישור הפעולה חייב להיות מסלול פנימי במערכת")
    update = AgentUpdate(
        agent_id=agent.id, **payload.model_dump(), status="new", created_at=_agent_now(),
    )
    agent.last_seen_at = _agent_now()
    db.add(update)
    db.commit()
    db.refresh(update)
    return agent_update_dict(update)


@app.patch("/api/agent-updates/{update_id}")
def update_agent_update(
    update_id: int, payload: schemas.AgentInsightUpdate, db: Session = Depends(get_db),
):
    update = db.get(AgentUpdate, update_id)
    if not update:
        raise HTTPException(404, "עדכון הסוכן לא נמצא")
    update.status = payload.status
    db.commit()
    db.refresh(update)
    return agent_update_dict(update)


# ---------- Substitutions ----------

@app.get("/api/ingredients/{ingredient_id}/substitutions")
def ingredient_substitutions(ingredient_id: int, db: Session = Depends(get_db)):
    i = db.get(Ingredient, ingredient_id)
    if not i:
        raise HTTPException(404, "המצרך לא נמצא")
    return {
        "ingredient_id": i.id,
        "name": i.name,
        "substitutions": get_substitutions(db, i),
    }


# ---------- Smart menu ----------

@app.post("/api/events/{event_id}/menu/suggest")
def suggest_event_menu(event_id: int, payload: dict | None = None,
                       db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    auto_update_status(db, e)
    return suggest_menu(db, e, payload)


# ---------- Clients ----------

@app.get("/api/clients")
def list_clients(db: Session = Depends(get_db)):
    out = []
    for c in db.query(Client).all():
        row = client_dict(c)
        row["summary"] = client_summary(db, c)
        out.append(row)
    return out


@app.post("/api/clients", status_code=201)
def create_client(payload: schemas.ClientCreate, db: Session = Depends(get_db)):
    c = Client(**payload.model_dump(), created_at=date.today().isoformat())
    db.add(c)
    db.commit()
    db.refresh(c)
    return client_dict(c)


@app.put("/api/clients/{client_id}")
def update_client(client_id: int, payload: schemas.ClientUpdate,
                  db: Session = Depends(get_db)):
    c = db.get(Client, client_id)
    if not c:
        raise HTTPException(404, "הלקוח לא נמצא")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return client_dict(c)


@app.delete("/api/clients/{client_id}", status_code=204)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    c = db.get(Client, client_id)
    if not c:
        raise HTTPException(404, "הלקוח לא נמצא")
    for e in c.events:
        e.client_id = None
    for l in c.leads:
        l.client_id = None
    db.delete(c)
    db.commit()


@app.get("/api/clients/{client_id}/summary")
def get_client_summary(client_id: int, db: Session = Depends(get_db)):
    c = db.get(Client, client_id)
    if not c:
        raise HTTPException(404, "הלקוח לא נמצא")
    return client_summary(db, c)


# ---------- Employees ----------

@app.get("/api/employees")
def list_employees(db: Session = Depends(get_db)):
    return [employee_dict(e) for e in db.query(Employee).order_by(Employee.name).all()]


@app.post("/api/employees", status_code=201)
def create_employee(payload: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    e = Employee(**payload.model_dump(), created_at=date.today().isoformat())
    db.add(e)
    db.commit()
    db.refresh(e)
    return employee_dict(e)


@app.put("/api/employees/{employee_id}")
def update_employee(employee_id: int, payload: schemas.EmployeeUpdate,
                    db: Session = Depends(get_db)):
    e = db.get(Employee, employee_id)
    if not e:
        raise HTTPException(404, "איש הצוות לא נמצא")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    db.commit()
    db.refresh(e)
    return employee_dict(e)


@app.delete("/api/employees/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    e = db.get(Employee, employee_id)
    if not e:
        raise HTTPException(404, "איש הצוות לא נמצא")
    db.delete(e)
    db.commit()


# ---------- Leads / Quotes ----------

@app.get("/api/leads")
def list_leads(db: Session = Depends(get_db)):
    return [lead_dict(l) for l in db.query(Lead).all()]


@app.post("/api/leads", status_code=201)
def create_lead(payload: schemas.LeadCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data["kind"] not in LEAD_KINDS:
        raise HTTPException(400, f"סוג הזדמנות לא נתמך: '{data['kind']}'")
    if data["status"] not in LEAD_STATUSES[data["kind"]]:
        raise HTTPException(400, f"הסטטוס '{data['status']}' אינו מתאים לסוג '{data['kind']}'")
    if data.get("client_id") is not None and not db.get(Client, data["client_id"]):
        raise HTTPException(400, "הלקוח לא נמצא")
    l = Lead(**data, created_at=date.today().isoformat())
    db.add(l)
    db.commit()
    db.refresh(l)
    return lead_dict(l)


@app.put("/api/leads/{lead_id}")
def update_lead(lead_id: int, payload: schemas.LeadUpdate,
                db: Session = Depends(get_db)):
    l = db.get(Lead, lead_id)
    if not l:
        raise HTTPException(404, "ההזדמנות לא נמצאה")
    data = payload.model_dump(exclude_unset=True)
    kind = data.get("kind", l.kind)
    if kind not in LEAD_KINDS:
        raise HTTPException(400, f"סוג הזדמנות לא נתמך: '{kind}'")
    status = data.get("status", l.status)
    if status not in LEAD_STATUSES[kind]:
        raise HTTPException(400, f"הסטטוס '{status}' אינו מתאים לסוג '{kind}'")
    if data.get("client_id") is not None and not db.get(Client, data["client_id"]):
        raise HTTPException(400, "הלקוח לא נמצא")
    if "converted_event_id" in data and data["converted_event_id"] is not None \
            and not db.get(Event, data["converted_event_id"]):
        raise HTTPException(400, "האירוע לא נמצא")
    for k, v in data.items():
        setattr(l, k, v)
    db.commit()
    db.refresh(l)
    return lead_dict(l)


@app.post("/api/leads/{lead_id}/convert")
def convert_lead(lead_id: int, db: Session = Depends(get_db)):
    """Create a job (Event) from an accepted quote."""
    l = db.get(Lead, lead_id)
    if not l:
        raise HTTPException(404, "ההזדמנות לא נמצאה")
    if l.converted_event_id:
        return event_dict(db.get(Event, l.converted_event_id))
    if l.kind != "quote":
        raise HTTPException(400, "רק הצעת מחיר ניתנת להמרה לעבודה")
    ev = Event(
        name=l.title,
        date=l.preferred_date or date.today().isoformat(),
        client_id=l.client_id,
        total_guests=l.guest_estimate or 1,
        event_type=l.event_type,
        agreed_price=l.amount or 0.0,
        status="confirmed",
        notes=l.notes,
    )
    db.add(ev)
    db.flush()
    l.converted_event_id = ev.id
    l.status = "accepted"
    db.commit()
    db.refresh(ev)
    return event_dict(ev)


@app.delete("/api/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    l = db.get(Lead, lead_id)
    if not l:
        raise HTTPException(404, "ההזדמנות לא נמצאה")
    db.delete(l)
    db.commit()


# ---------- Payments ----------

@app.post("/api/events/{event_id}/payments", status_code=201)
def add_payment(event_id: int, payload: schemas.PaymentCreate,
                db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    p = Payment(event_id=e.id, **payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    sync_status_from_payments(db, e)
    return payment_dict(p)


@app.delete("/api/payments/{payment_id}", status_code=204)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(404, "התשלום לא נמצא")
    db.delete(p)
    db.commit()


# ---------- Price book ----------

@app.get("/api/ingredients/{ingredient_id}/price-book")
def list_price_book(ingredient_id: int, db: Session = Depends(get_db)):
    i = db.get(Ingredient, ingredient_id)
    if not i:
        raise HTTPException(404, "המצרך לא נמצא")
    rows = db.query(PriceBook).filter(PriceBook.ingredient_id == ingredient_id) \
        .order_by(PriceBook.effective_date).all()
    return [pricebook_dict(r) for r in rows]


@app.post("/api/ingredients/{ingredient_id}/price-book", status_code=201)
def add_price_book(ingredient_id: int, payload: schemas.PriceBookCreate,
                   db: Session = Depends(get_db)):
    i = db.get(Ingredient, ingredient_id)
    if not i:
        raise HTTPException(404, "המצרך לא נמצא")
    r = PriceBook(ingredient_id=i.id, **payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return pricebook_dict(r)


@app.delete("/api/price-book/{price_id}", status_code=204)
def delete_price_book(price_id: int, db: Session = Depends(get_db)):
    r = db.get(PriceBook, price_id)
    if not r:
        raise HTTPException(404, "רשומת המחיר לא נמצאה")
    db.delete(r)
    db.commit()


# ---------- Dashboards ----------

@app.get("/api/finance/summary")
def finance_summary_endpoint(period: str = "all", db: Session = Depends(get_db)):
    return finance_summary(db, period)


@app.get("/api/work/summary")
def work_summary_endpoint(db: Session = Depends(get_db)):
    return work_summary(db)


@app.get("/api/home/summary")
def home_summary_endpoint(db: Session = Depends(get_db)):
    return {
        "work": work_summary(db),
        "finance_month": finance_summary(db, "month"),
        "briefing": business_briefing(db),
        "insights": home_insights(db),
        "agent_updates": [agent_update_dict(item) for item in db.query(AgentUpdate)
                          .filter(AgentUpdate.status != "resolved")
                          .order_by(AgentUpdate.id.desc()).limit(3).all()],
    }


def home_insights(db: Session) -> dict:
    """Small, factual signals for the personal dashboard — no AI guesses."""
    today = date.today().isoformat()
    active = [event for event in db.query(Event).all() if event.status in ("confirmed", "production")]
    future = [event for event in active if event.date and event.date >= today]
    menu_missing = [event for event in future if not event.menu_items]
    low_stock = [holding for holding in db.query(PantryHolding).all() if (holding.quantity or 0) <= 0]
    price_changes = []
    price_rows_by_ingredient: dict[int, list[PriceBook]] = {}
    for row in db.query(PriceBook).all():
        price_rows_by_ingredient.setdefault(row.ingredient_id, []).append(row)
    ingredient_names = {ingredient.id: ingredient.name for ingredient in db.query(Ingredient).all()}
    for ingredient_id, rows in price_rows_by_ingredient.items():
        rows = sorted([row for row in rows if row.effective_date <= today], key=lambda row: (row.effective_date, row.id), reverse=True)
        if len(rows) < 2 or rows[1].price_per_unit <= 0:
            continue
        from .units import convert_quantity
        ingredient = db.get(Ingredient, ingredient_id)
        conversion = convert_quantity(1, rows[1].unit or ingredient.default_unit, rows[0].unit or ingredient.default_unit, ingredient.density)
        if not conversion.ok:
            continue
        change = (conversion.value * rows[0].price_per_unit - rows[1].price_per_unit) / rows[1].price_per_unit * 100
        if abs(change) >= 1:
            price_changes.append({"name": ingredient_names.get(ingredient_id, "חומר גלם"), "change_percent": round(change, 1)})
    price_changes.sort(key=lambda row: abs(row["change_percent"]), reverse=True)
    all_time = finance_summary(db, "all")
    return {
        "future_events": len(future),
        "earned_to_date": all_time["completed_net"],
        "low_stock_count": len(low_stock),
        "price_increases": [row for row in price_changes if row["change_percent"] > 0][:3],
        "price_decreases": [row for row in price_changes if row["change_percent"] < 0][:3],
        "menu_missing": [{"id": event.id, "name": event.name, "date": event.date} for event in menu_missing[:4]],
    }


# ---------- Pantry (inventory) ----------

@app.get("/api/pantry")
def list_pantry(db: Session = Depends(get_db)):
    out = []
    for h in db.query(PantryHolding).all():
        out.append({
            "id": h.id,
            "ingredient_id": h.ingredient_id,
            "name": h.ingredient.name if h.ingredient else None,
            "category": h.ingredient.category if h.ingredient else None,
            "quantity": h.quantity,
            "unit": h.unit,
            "updated_at": h.updated_at,
        })
    return out


@app.put("/api/pantry/{ingredient_id}")
def set_pantry(ingredient_id: int, payload: dict, db: Session = Depends(get_db)):
    ing = db.get(Ingredient, ingredient_id)
    if not ing:
        raise HTTPException(404, "המצרך לא נמצא")
    try:
        qty = float(payload.get("quantity", 0) or 0)
    except (TypeError, ValueError):
        raise HTTPException(422, "הכמות חייבת להיות מספר")
    if qty < 0:
        raise HTTPException(422, "הכמות לא יכולה להיות שלילית")
    unit = payload.get("unit") or ing.default_unit
    h = db.query(PantryHolding).filter(PantryHolding.ingredient_id == ingredient_id).first()
    if h is None:
        h = PantryHolding(ingredient_id=ingredient_id, quantity=qty, unit=unit,
                          updated_at=date.today().isoformat())
        db.add(h)
    else:
        h.quantity = qty
        h.unit = unit
        h.updated_at = date.today().isoformat()
    db.commit()
    db.refresh(h)
    return {"id": h.id, "ingredient_id": h.ingredient_id, "quantity": h.quantity,
            "unit": h.unit, "updated_at": h.updated_at}


@app.delete("/api/pantry/{ingredient_id}", status_code=204)
def clear_pantry(ingredient_id: int, db: Session = Depends(get_db)):
    h = db.query(PantryHolding).filter(PantryHolding.ingredient_id == ingredient_id).first()
    if h:
        db.delete(h)
        db.commit()


# ---------- Event readiness / prep plan ----------

@app.get("/api/events/{event_id}/readiness")
def get_event_readiness(event_id: int, db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    auto_update_status(db, e)
    return event_readiness(db, e)


@app.get("/api/events/{event_id}/prep-plan")
def get_event_prep_plan(event_id: int, db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    return prep_plan(db, e)


# ---------- Gamification ----------

@app.get("/api/profile/summary")
def profile_endpoint(db: Session = Depends(get_db)):
    return profile_summary(db)


# ---------- Import ----------

@app.post("/api/import/parse")
def import_parse(payload: dict):
    text = payload.get("text", "")
    return parse_recipe_text(text)


@app.post("/api/import/classify")
def import_classify(payload: dict):
    text = str(payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="יש להדביק טקסט לסיווג")
    if len(text) > 200_000:
        raise HTTPException(status_code=413, detail="הטקסט גדול מדי (עד 200,000 תווים)")
    return classify_intake(text)


@app.post("/api/import/upload")
async def import_upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename or ""
    kind = file_kind(filename)
    if kind not in SUPPORTED:
        raise HTTPException(400, f"פורמט לא נתמך: '{kind}' (נתמכים: txt/md/docx/pdf)")
    data = await file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "הקובץ גדול מדי. ניתן להעלות עד 10 מגה־בייט")
    text = extract_text(filename, data).strip()
    if not text:
        raise HTTPException(422, "לא הצלחנו לחלץ טקסט מהקובץ")
    classification = classify_intake(text)
    return {
        "filename": filename,
        "kind": kind,
        "text_preview": text[:400],
        "text": text,
        "classification": classification,
        "parsed": parse_recipe_text(text) if classification["kind"] == "recipe" else None,
    }


@app.post("/api/import/confirm", status_code=201)
def import_confirm(payload: schemas.ImportConfirm, db: Session = Depends(get_db)):
    """Create a recipe from confirmed parsed lines.

    payload: {name, ingredients: [{ingredient: name, quantity, unit}]}
    """
    name = payload.name
    lines = [line.model_dump() for line in payload.ingredients]
    r = Recipe(name=name, source="imported", scaling_model="servings", base_servings=1)
    db.add(r)
    db.flush()
    for line in lines:
        ing_name = line.get("ingredient", "")
        ing = find_ingredient_by_alias(db, ing_name)
        if not ing:
            ing = Ingredient(name=ing_name, category="other")
            db.add(ing)
            db.flush()
        db.add(RecipeIngredient(
            recipe_id=r.id, ingredient_id=ing.id,
            quantity=line.get("quantity", 1), unit=line.get("unit"),
        ))
    db.commit()
    db.refresh(r)
    return recipe_dict(r)


# ---------- Prep tasks ----------

@app.get("/api/events/{event_id}/prep-tasks")
def list_prep_tasks(event_id: int, db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    return [pt_dict(t) for t in e.prep_tasks]


@app.post("/api/events/{event_id}/prep-tasks", status_code=201)
def create_prep_task(event_id: int, payload: schemas.PrepTaskCreate,
                     db: Session = Depends(get_db)):
    _get_event(db, event_id)
    t = PrepTask(event_id=event_id, **payload.model_dump())
    db.add(t)
    db.commit()
    return pt_dict(t)


@app.post("/api/events/{event_id}/prep-tasks/suggest")
def suggest_prep_tasks(event_id: int, db: Session = Depends(get_db)):
    e = _get_event(db, event_id)
    suggestions = compute_prep_suggestions(db, e)
    return {"suggestions": suggestions}


@app.put("/api/prep-tasks/{task_id}")
def update_prep_task(task_id: int, payload: schemas.PrepTaskUpdate,
                     db: Session = Depends(get_db)):
    t = db.get(PrepTask, task_id)
    if not t:
        raise HTTPException(404, "משימת ההכנה לא נמצאה")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    return pt_dict(t)


@app.delete("/api/prep-tasks/{task_id}", status_code=204)
def delete_prep_task(task_id: int, db: Session = Depends(get_db)):
    t = db.get(PrepTask, task_id)
    if not t:
        raise HTTPException(404, "משימת ההכנה לא נמצאה")
    db.delete(t)
    db.commit()


# ---------- misc ----------

@app.post("/api/seed", status_code=201)
def run_seed(db: Session = Depends(get_db)):
    seed_all(db)
    return {"ok": True}


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(sql_text("SELECT 1"))
    return {"status": "ok"}


@app.get("/api/backup")
def download_backup():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        path = Path(tmp.name)
    try:
        backup_database(DB_PATH, path)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return FileResponse(path, media_type="application/octet-stream",
                        filename=f"private-chef-{date.today()}.db",
                        background=BackgroundTask(path.unlink, missing_ok=True))


# Static frontend serving (production build).
if FRONTEND_DIST.exists():
    app.mount("/", SPAStaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
