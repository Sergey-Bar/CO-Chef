// Hebrew-only UI strings and labels (the app is single-language, RTL).

export const CUISINE_LABELS: Record<string, string> = {
  italian: 'איטלקי',
  mexican: 'מקסיקני',
  indian: 'הודי',
  japanese: 'יפני',
  chinese: 'סיני',
  thai: 'תאילנדי',
  french: 'צרפתי',
  middle_eastern: 'מזרח תיכוני',
  american: 'אמריקאי',
  mediterranean: 'ים-תיכוני',
  korean: 'קוריאני',
  south_american: 'דרום אמריקאי',
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'חתונה',
  birthday: 'יום הולדת',
  corporate: 'אירוע חברה',
  dinner: 'ארוחת ערב',
  holiday: 'חג',
  bbq: 'על האש',
  other: 'אחר',
}

export const NUTRITION_LABELS: Record<string, string> = {
  calories: 'קלוריות',
  protein_g: 'חלבון (גרם)',
  carbs_g: 'פחמימות (גרם)',
  fat_g: 'שומן (גרם)',
  sodium_mg: 'נתרן (מ"ג)',
  sugar_g: 'סוכר (גרם)',
}

export const STATUS_LABELS: Record<string, string> = {
  confirmed: 'מאושרים',
  production: 'בביצוע',
  completed: 'הושלמו',
  invoiced: 'חשבונית נשלחה',
  paid: 'שולמו',
  archived: 'בארכיון',
}

export const STATUS_LABELS_SINGULAR: Record<string, string> = {
  confirmed: 'מאושר',
  production: 'בביצוע',
  completed: 'הושלם',
  invoiced: 'חשבונית נשלחה',
  paid: 'שולם',
  archived: 'בארכיון',
}

export const STATUS_ORDER = ['confirmed', 'production', 'completed', 'invoiced', 'paid', 'archived']

export const LEAD_KIND_LABELS: Record<string, string> = {
  lead: 'ליד',
  quote: 'הצעת מחיר',
}

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'חדש',
  contacted: 'נוצר קשר',
  won: 'נסגר',
  lost: 'אבד',
  draft: 'טיוטה',
  sent: 'נשלחה',
  accepted: 'התקבלה',
  declined: 'נדחתה',
}

export const LEAD_STATUSES: Record<string, string[]> = {
  lead: ['new', 'contacted', 'won', 'lost'],
  quote: ['draft', 'sent', 'accepted', 'declined'],
}

export function statusTone(status: string): 'accent' | 'neutral' | 'success' | 'warn' | 'danger' {
  switch (status) {
    case 'confirmed': return 'accent'
    case 'production': return 'warn'
    case 'completed': return 'neutral'
    case 'invoiced': return 'warn'
    case 'paid': return 'success'
    default: return 'neutral'
  }
}

export const SCALING_LABELS: Record<string, string> = {
  servings: 'לפי מנות',
  per_person: 'לאדם',
  batch: 'לפי אצווה',
}

export const SOURCE_LABELS: Record<string, string> = {
  user: 'שלי',
  builtin: 'מספריית המתכונים',
  imported: 'מיובא',
}

export const RECIPE_LABELS: Record<string, string> = {
  'Spaghetti Bolognese': 'ספגטי בולונז', 'Margherita Pizza': 'פיצה מרגריטה', 'Mushroom Risotto': 'ריזוטו פטריות',
  'Tiramisu': 'טירמיסו', 'Penne Arrabbiata': 'פנה ארביאטה', 'Minestrone Soup': 'מרק מינסטרונה',
  'Chicken Tacos': 'טאקו עוף', 'Guacamole': 'גוואקמולי', 'Black Bean Burritos': 'בוריטו שעועית שחורה',
  'Salsa Fresca': 'סלסה טרייה', 'Enchiladas': 'אנצ׳ילדות', 'Butter Chicken': 'עוף בחמאה',
  'Chana Masala': 'צ׳אנה מסאלה', 'Basmati Rice Pilaf': 'אורז בסמטי מתובל', 'Saag Paneer': 'סאג פניר',
  'Dal Tadka': 'דאל טדקה', 'Vegetable Samosas': 'סמוסות ירק', 'Chicken Teriyaki': 'עוף טריאקי',
  'Sushi Rice': 'אורז לסושי', 'Miso Soup': 'מרק מיסו', 'Vegetable Ramen': 'ראמן ירקות',
  'Okonomiyaki': 'אוקונומיאקי', 'Vegetable Fried Rice': 'אורז מוקפץ עם ירקות', 'Kung Pao Chicken': 'עוף קונג פאו',
  'Beef & Broccoli': 'בקר וברוקולי', 'Steamed Dumplings': 'כיסונים מאודים', 'Hot & Sour Soup': 'מרק חמוץ־חריף',
  'Green Curry': 'קארי ירוק', 'Pad Thai': 'פאד תאי', 'Tom Yum Soup': 'מרק טום יאם',
  'Thai Basil Chicken': 'עוף תאילנדי עם בזיליקום', 'Coq au Vin': 'קוק או ון', 'Ratatouille': 'רטטוי',
  'French Onion Soup': 'מרק בצל צרפתי', 'Crème Brûlée': 'קרם ברולה', 'Quiche Lorraine': 'קיש לורן',
  'Hummus': 'חומוס', 'Falafel': 'פלאפל', 'Tabbouleh': 'טאבולה', 'Chicken Shawarma': 'שווארמה עוף',
  'Baba Ghanoush': 'באבא גנוש', 'BBQ Pulled Pork': 'בשר חזיר מפורק בברביקיו', 'Baked Mac & Cheese': 'מק אנד צ׳יז אפוי',
  'Classic Caesar Salad': 'סלט קיסר קלאסי', 'Sweet Cornbread': 'לחם תירס מתוק', 'Buffalo Wings': 'כנפי באפלו',
  'Greek Salad': 'סלט יווני', 'Tzatziki': 'צזיקי', 'Spanakopita': 'ספנקופיטה', 'Lamb Kofta': 'קופטה טלה',
  'Couscous Salad': 'סלט קוסקוס', 'Bulgogi Beef': 'בקר בולגוגי', 'Kimchi Fried Rice': 'אורז מוקפץ עם קימצ׳י',
  'Bibimbap': 'ביבימבאפ', 'Chicken Empanadas': 'אמפנדס עוף', 'Spanish Rice': 'אורז ספרדי', 'Arepas': 'ארפס',
  'Chicken Caesar Wrap': 'טורטייה עם עוף וסלט קיסר', 'Mushroom Fried Rice': 'אורז מוקפץ עם פטריות',
  'Roasted Vegetable Bowl': 'קערת ירקות צלויים', 'Lentil Soup': 'מרק עדשים', 'Beef Stroganoff': 'ביף סטרוגנוף',
  'Classic Chocolate Chip Cookies': 'עוגיות שוקולד צ׳יפס', 'Roast Chicken with Vegetables': 'עוף צלוי עם ירקות',
  'Lemon Vinaigrette': 'ויניגרט לימון',
}

export function recipeLabel(name: string): string {
  return RECIPE_LABELS[name] ?? name
}

const INGREDIENT_LABELS: Record<string, string> = {
  'White onion':'בצל לבן','Red onion':'בצל סגול','Yellow onion':'בצל צהוב','Scallions':'בצל ירוק','Garlic':'שום','Ginger':'ג׳ינג׳ר','Carrots':'גזר','Celery':'סלרי','Potatoes':'תפוחי אדמה','Sweet potato':'בטטה','Zucchini':'קישוא','Eggplant':'חציל','Bell peppers':'פלפל מתוק','Jalapeño':'חלפיניו','Cherry tomatoes':'עגבניות שרי','Plum tomatoes':'עגבניות תמר','Tomatoes':'עגבניות','Mushrooms':'פטריות','Baby spinach':'תרד צעיר','Kale':'קייל','Broccoli':'ברוקולי','Cauliflower':'כרובית','Green cabbage':'כרוב ירוק','Napa cabbage':'כרוב סיני','Bok choy':'בוק צ׳וי','Cucumber':'מלפפון','Avocado':'אבוקדו','Pear':'אגס','Peas':'אפונה','Corn kernels':'גרגירי תירס','Green beans':'שעועית ירוקה','Snow peas':'אפונת שלג','Bean sprouts':'נבטי שעועית','Shallots':'שאלוט','Lemons':'לימונים','Lemon juice':'מיץ לימון','Limes':'ליים','Cilantro':'כוסברה','Lemongrass':'למון גראס','Parsley':'פטרוזיליה','Basil':'בזיליקום','Mint':'נענע','Dill':'שמיר','Rosemary':'רוזמרין','Thyme':'טימין','Arugula':'רוקט','Romaine lettuce':'חסה רומית',
  'Chicken breast':'חזה עוף','Chicken thighs':'ירכי עוף','Ground beef':'בשר בקר טחון','Beef stew meat':'בשר בקר לבישול','Pork shoulder':'כתף חזיר','Bacon':'בייקון','Ground lamb':'טלה טחון','Shrimp':'שרימפס','Salmon fillet':'פילה סלמון','White fish fillets':'פילה דג לבן','Tofu':'טופו','Milk':'חלב','Heavy cream':'שמנת מתוקה','Butter':'חמאה','Unsalted butter':'חמאה ללא מלח','Plain yogurt':'יוגורט טבעי','Greek yogurt':'יוגורט יווני','Parmesan':'פרמזן','Mozzarella':'מוצרלה','Cheddar cheese':'גבינת צ׳דר','Feta cheese':'גבינת פטה','Ricotta':'ריקוטה','Cream cheese':'גבינת שמנת','Paneer':'פניר','Sour cream':'שמנת חמוצה','Eggs':'ביצים',
  'White rice':'אורז לבן','Jasmine rice':'אורז יסמין','Basmati rice':'אורז בסמטי','Arborio rice':'אורז ארבוריו','Sushi rice':'אורז לסושי','Pasta':'פסטה','Lasagna noodles':'דפי לזניה','Rice noodles':'אטריות אורז','Ramen noodles':'אטריות ראמן','All-purpose flour':'קמח לבן','Bread flour':'קמח לחם','Cornmeal':'קמח תירס','Cornstarch':'קורנפלור','Rolled oats':'שיבולת שועל','Bread crumbs':'פירורי לחם','Couscous':'קוסקוס','Quinoa':'קינואה','Lentils':'עדשים','Red lentils':'עדשים אדומות','Chickpeas':'גרגירי חומוס','Black beans':'שעועית שחורה','Kidney beans':'שעועית אדומה','Pinto beans':'שעועית פינטו',
  'Coconut milk':'חלב קוקוס','Soy sauce':'רוטב סויה','Hoisin sauce':'רוטב הויסין','Sesame oil':'שמן שומשום','Vegetable oil':'שמן צמחי','Olive oil':'שמן זית','Peanut oil':'שמן בוטנים','Red wine vinegar':'חומץ יין אדום','Balsamic vinegar':'חומץ בלסמי','Rice vinegar':'חומץ אורז','Apple cider vinegar':'חומץ תפוחים','White vinegar':'חומץ לבן','Granulated sugar':'סוכר לבן','Brown sugar':'סוכר חום','Powdered sugar':'אבקת סוכר','Honey':'דבש','Maple syrup':'סירופ מייפל','Molasses':'מולסה','Vanilla extract':'תמצית וניל','Cocoa powder':'אבקת קקאו','Baking soda':'סודה לשתייה','Baking powder':'אבקת אפייה','Active dry yeast':'שמרים יבשים','Peanut butter':'חמאת בוטנים','Tomato paste':'רסק עגבניות','Tomato sauce':'רוטב עגבניות','Diced tomatoes':'עגבניות קצוצות','Tahini':'טחינה','Worcestershire sauce':'רוטב ווסטרשייר','Dijon mustard':'חרדל דיז׳ון','Yellow mustard':'חרדל צהוב','Sriracha':'סריראצ׳ה','Fish sauce':'רוטב דגים','Oyster sauce':'רוטב צדפות','Mirin':'מירין','Gochujang':'גוצ׳וג׳אנג','Kimchi':'קימצ׳י','Flour tortillas':'טורטיות קמח','Corn tortillas':'טורטיות תירס','Phyllo dough':'בצק פילו','Wonton wrappers':'עלי וונטון','Dark chocolate':'שוקולד מריר','Chocolate chips':'שוקולד צ׳יפס',
  'Kosher salt':'מלח','Black pepper':'פלפל שחור','White pepper':'פלפל לבן','Cumin':'כמון','Ground coriander':'כוסברה טחונה','Paprika':'פפריקה','Smoked paprika':'פפריקה מעושנת','Turmeric':'כורכום','Garam masala':'גראם מסאלה','Curry powder':'אבקת קארי','Chili powder':'אבקת צ׳ילי','Cayenne pepper':'פלפל קאיין','Dried oregano':'אורגנו מיובש','Dried basil':'בזיליקום מיובש','Dried thyme':'טימין מיובש','Ground cinnamon':'קינמון טחון','Nutmeg':'אגוז מוסקט','Ground cloves':'ציפורן טחונה','Cardamom':'הל','Star anise':'כוכב אניס','Bay leaves':'עלי דפנה','Fennel seed':'זרעי שומר','Mustard seeds':'זרעי חרדל','Five-spice powder':'תערובת חמשת התבלינים','Sumac':'סומאק',"Za'atar":'זעתר','Harissa paste':'ממרח אריסה','Garlic powder':'אבקת שום','Onion powder':'אבקת בצל','Saffron':'זעפרן','Almonds':'שקדים','Walnuts':'אגוזי מלך','Peanuts':'בוטנים','Cashews':'קשיו','Sesame seeds':'שומשום','Pine nuts':'צנוברים','Sunflower seeds':'גרעיני חמנייה',
}

export function ingredientLabel(name: string): string {
  return INGREDIENT_LABELS[name] ?? name
}

export const CATEGORY_LABELS: Record<string, string> = {
  produce: 'ירקות ופירות',
  meat: 'בשר ודגים',
  dairy: 'מוצרי חלב',
  bakery: 'מאפים',
  pantry: 'מזווה',
  spices: 'תבלינים',
  frozen: 'קפוא',
  other: 'אחר',
  main: 'מנה עיקרית',
  appetizer: 'מנה ראשונה',
  side: 'תוספת',
  soup: 'מרק',
  dessert: 'קינוח',
  bread: 'לחם ומאפים',
  dressing: 'רוטב',
}

export const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'גלוטן', dairy: 'חלב', egg: 'ביצים', eggs: 'ביצים', soy: 'סויה',
  peanuts: 'בוטנים', nuts: 'אגוזים', sesame: 'שומשום', shellfish: 'פירות ים',
  fish: 'דגים', mustard: 'חרדל', celery: 'סלרי', sulfites: 'סולפיטים', lupin: 'תורמוס',
}

export function allergenLabel(key: string): string {
  return ALLERGEN_LABELS[key] ?? key
}

export function cuisineLabel(key: string | null | undefined): string {
  if (!key) return ''
  return CUISINE_LABELS[key] ?? key
}

export function formatMoney(n: number | null | undefined, _currency?: string): string {
  if (n == null) return '—'
  try {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(n)
  } catch {
    return `${n.toFixed(2)} ₪`
  }
}

export function eventTypeLabel(key: string | null | undefined): string {
  if (!key) return ''
  return EVENT_TYPE_LABELS[key] ?? key
}
