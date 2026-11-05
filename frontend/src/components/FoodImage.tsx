import foodSprite from '../assets/food-sprite.png'

const categoryFrames: Record<string, number[]> = {
  herbs: [0, 1, 10], vegetables: [1, 0, 7], produce: [1, 0, 7], grains: [2, 9], pantry: [2, 9, 10],
  dairy: [3], eggs: [3], fish: [4, 11], seafood: [4, 11], meat: [5, 11],
  pasta: [6, 11], salad: [7, 1], dessert: [8], bakery: [9, 2], spices: [10],
  main: [11, 5, 6], appetizer: [7, 1, 11], other: [11, 1, 10],
}

function hash(value: string) {
  let result = 0
  for (let i = 0; i < value.length; i += 1) result = ((result << 5) - result + value.charCodeAt(i)) | 0
  return Math.abs(result)
}

function semanticFrame(name: string): number | null {
  const value = name.toLowerCase()
  const rules: [string[], number][] = [
    [['טירמיסו', 'קינוח', 'קרם ברולה', 'עוגיות', 'שוקולד', 'dessert', 'cookie'], 8],
    [['לחם', 'פיצה', 'קורנברד', 'מאפה', 'bread', 'pizza'], 9],
    [['סלט', 'טאבולה', 'גוואקמולי', 'סלסה', 'salad'], 7],
    [['פסטה', 'ספגטי', 'פנה', 'ריזוטו', 'ראמן', 'אטריות', 'פאד תאי', 'מקרוני', 'pasta', 'risotto', 'ramen', 'noodle'], 6],
    [['סלמון', 'דג', 'שרימפס', 'סושי', 'fish', 'salmon', 'shrimp', 'sushi'], 4],
    [['עוף', 'בקר', 'טלה', 'חזיר', 'בשר', 'קופטה', 'שווארמה', 'chicken', 'beef', 'lamb', 'pork', 'meat'], 5],
    [['קארי', 'מסאלה', 'דאל', 'חריף', 'curry', 'masala'], 10],
    [['ירק', 'מרק', 'חומוס', 'פלאפל', 'טופו', 'vegetable', 'soup', 'hummus', 'falafel'], 1],
  ]
  return rules.find(([words]) => words.some(word => value.includes(word)))?.[1] ?? null
}

export function FoodImage({ name, category, className = '' }: {
  name: string
  category?: string | null
  className?: string
}) {
  const normalized = (category ?? '').trim().toLowerCase()
  const options = categoryFrames[normalized]
  const frame = semanticFrame(name) ?? (options ? options[hash(name) % options.length] : hash(`${name}:${normalized}`) % 12)
  const column = frame % 4
  const row = Math.floor(frame / 4)
  return (
    <span
      className={`food-image ${className}`}
      role="img"
      aria-label={`תמונה של ${name}`}
      style={{
        backgroundImage: `url(${foodSprite})`,
        backgroundPosition: `${column * (100 / 3)}% ${row * 50}%`,
      }}
    />
  )
}
