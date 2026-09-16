-- CreateTable
CREATE TABLE "ClothingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "pattern" TEXT,
    "material" TEXT,
    "seasons" TEXT NOT NULL DEFAULT '[]',
    "occasions" TEXT NOT NULL DEFAULT '[]',
    "brand" TEXT,
    "size" TEXT,
    "price" REAL,
    "purchaseDate" DATETIME,
    "storageStatus" TEXT NOT NULL DEFAULT 'wearing',
    "storageLocation" TEXT,
    "wearCount" INTEGER NOT NULL DEFAULT 0,
    "lastWornAt" DATETIME,
    "imageData" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Outfit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "date" TEXT NOT NULL,
    "occasion" TEXT,
    "weather" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OutfitItem" (
    "outfitId" TEXT NOT NULL,
    "clothingItemId" TEXT NOT NULL,

    PRIMARY KEY ("outfitId", "clothingItemId"),
    CONSTRAINT "OutfitItem_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutfitItem_clothingItemId_fkey" FOREIGN KEY ("clothingItemId") REFERENCES "ClothingItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "category" TEXT,
    "expectedPrice" REAL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Outfit_userId_date_idx" ON "Outfit"("userId", "date");

