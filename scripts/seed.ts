// 种子数据：12 件示例衣物（使用 public/seed 下的生成图片）
// 运行：bun scripts/seed.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const ITEMS: {
  name: string
  category: string
  color: string
  pattern: string
  material: string
  seasons: string[]
  occasions: string[]
  brand: string
  size: string
  price: number
  image: string
}[] = [
  { name: '白色衬衫', category: 'top', color: '白色', pattern: 'solid', material: '棉', seasons: ['spring', 'autumn'], occasions: ['commute', 'formal', 'casual'], brand: 'UNIQLO', size: 'M', price: 199, image: '/seed/white-shirt.png' },
  { name: '黑色针织毛衣', category: 'top', color: '黑色', pattern: 'solid', material: '羊毛', seasons: ['autumn', 'winter'], occasions: ['commute', 'casual', 'date'], brand: 'ZARA', size: 'L', price: 399, image: '/seed/black-sweater.png' },
  { name: '藏蓝条纹T恤', category: 'top', color: '藏蓝', pattern: 'striped', material: '棉', seasons: ['summer'], occasions: ['casual', 'sport'], brand: 'MUJI', size: 'M', price: 129, image: '/seed/navy-stripe-tee.png' },
  { name: '深蓝牛仔裤', category: 'pants', color: '牛仔蓝', pattern: 'solid', material: '牛仔', seasons: ['spring', 'autumn', 'winter'], occasions: ['casual', 'commute', 'date'], brand: 'Levi\'s', size: '32', price: 599, image: '/seed/blue-jeans.png' },
  { name: '卡其休闲裤', category: 'pants', color: '卡其', pattern: 'solid', material: '棉', seasons: ['spring', 'autumn'], occasions: ['commute', 'casual'], brand: 'GAP', size: '32', price: 349, image: '/seed/khaki-pants.png' },
  { name: '黑色运动短裤', category: 'pants', color: '黑色', pattern: 'solid', material: '涤纶', seasons: ['summer'], occasions: ['sport', 'home'], brand: 'Nike', size: 'L', price: 229, image: '/seed/black-shorts.png' },
  { name: '米色风衣', category: 'outer', color: '米色', pattern: 'solid', material: '棉', seasons: ['spring', 'autumn'], occasions: ['commute', 'date', 'casual'], brand: 'COS', size: 'M', price: 1290, image: '/seed/beige-trench.png' },
  { name: '黑色羽绒服', category: 'outer', color: '黑色', pattern: 'solid', material: '羽绒', seasons: ['winter'], occasions: ['casual', 'commute'], brand: '波司登', size: 'L', price: 1499, image: '/seed/black-down-jacket.png' },
  { name: '白色运动鞋', category: 'shoes', color: '白色', pattern: 'solid', material: '皮革', seasons: ['all'], occasions: ['casual', 'sport', 'commute'], brand: 'Adidas', size: '42', price: 699, image: '/seed/white-sneakers.png' },
  { name: '黑色乐福鞋', category: 'shoes', color: '黑色', pattern: 'solid', material: '皮革', seasons: ['all'], occasions: ['commute', 'formal', 'date'], brand: 'Clarks', size: '42', price: 859, image: '/seed/black-loafers.png' },
  { name: '棕色单肩包', category: 'bag', color: '棕色', pattern: 'solid', material: '皮革', seasons: ['all'], occasions: ['commute', 'date', 'casual'], brand: 'Coach', size: '中号', price: 2300, image: '/seed/brown-bag.png' },
  { name: '黑色连衣裙', category: 'skirt', color: '黑色', pattern: 'solid', material: '聚酯纤维', seasons: ['spring', 'autumn'], occasions: ['date', 'formal'], brand: 'Mango', size: 'S', price: 659, image: '/seed/black-dress.png' },
]

async function main() {
  const count = await db.clothingItem.count()
  if (count > 0) {
    console.log(`已有 ${count} 件衣物，跳过种子数据`)
    return
  }
  for (const it of ITEMS) {
    await db.clothingItem.create({
      data: {
        name: it.name,
        category: it.category,
        color: it.color,
        pattern: it.pattern,
        material: it.material,
        seasons: JSON.stringify(it.seasons),
        occasions: JSON.stringify(it.occasions),
        brand: it.brand,
        size: it.size,
        price: it.price,
        storageStatus: 'wearing',
        wearCount: Math.floor(Math.random() * 6),
        lastWornAt: Math.random() > 0.4 ? new Date(Date.now() - Math.floor(Math.random() * 20) * 86400000) : null,
        imageData: it.image,
      },
    })
  }
  console.log(`已写入 ${ITEMS.length} 件种子衣物`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
