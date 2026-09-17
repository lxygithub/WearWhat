-- ============================================================
-- WearWhat 今天穿什么 · PostgreSQL schema（2026-09 · D1 → PG 迁移）
--
-- 执行身份：数据库 owner（应用运行时的 ro/rw 账号按设计无 DDL 权限，
-- 见 sql-gateway《使用与接入指南》坑 2）。
-- 执行位置：forgotit-postgres target 连接串指向的那个库（当前为 forgotit）。
--
-- 使用前把 __RO__ / __RW__ 替换为 /etc/sql-gateway/gateway.env 里
-- forgotit-postgres 的 readOnlyUrlEnv / readWriteUrlEnv 账号名：
--   sed 's/__RO__/sql_gateway_forgotit_ro/g; s/__RW__/sql_gateway_forgotit_rw/g' scripts/pg-schema.sql > /tmp/wearwhat-schema.sql
--   docker exec -i forgotit-postgres psql -U forgotit -d forgotit -v ON_ERROR_STOP=1 -f - < /tmp/wearwhat-schema.sql
--
-- 幂等：可重复执行。表集中在独立 schema `wearwhat`，与 ForgotIt / daohang 业务表隔离。
-- 类型映射：SQLite TEXT→text、REAL→double precision、INTEGER→integer、
--           BOOLEAN→boolean、DATETIME→timestamp(3)（Prisma PG 默认精度）。
-- ============================================================

CREATE SCHEMA IF NOT EXISTS wearwhat;

CREATE TABLE IF NOT EXISTS wearwhat."User" (
  "id"           text NOT NULL,
  "email"        text NOT NULL,
  "passwordHash" text NOT NULL,
  "name"         text,
  "createdAt"    timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    timestamp(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON wearwhat."User"("email");

CREATE TABLE IF NOT EXISTS wearwhat."VerificationCode" (
  "id"        text NOT NULL,
  "email"     text NOT NULL,
  "code"      text NOT NULL,
  "type"      text NOT NULL,
  "expiresAt" timestamp(3) NOT NULL,
  "used"      boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VerificationCode_email_type_idx" ON wearwhat."VerificationCode"("email", "type");

CREATE TABLE IF NOT EXISTS wearwhat."ClothingItem" (
  "id"              text NOT NULL,
  "userId"          text NOT NULL DEFAULT 'default',
  "name"            text,
  "category"        text NOT NULL,
  "color"           text,
  "pattern"         text,
  "material"        text,
  "seasons"         text NOT NULL DEFAULT '[]',
  "occasions"       text NOT NULL DEFAULT '[]',
  "brand"           text,
  "size"            text,
  "price"           double precision,
  "purchaseDate"    timestamp(3),
  "storageStatus"   text NOT NULL DEFAULT 'wearing',
  "storageLocation" text,
  "wearCount"       integer NOT NULL DEFAULT 0,
  "lastWornAt"      timestamp(3),
  "imageData"       text,
  "notes"           text,
  "createdAt"       timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       timestamp(3) NOT NULL,
  CONSTRAINT "ClothingItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClothingItem_userId_idx" ON wearwhat."ClothingItem"("userId");

CREATE TABLE IF NOT EXISTS wearwhat."Outfit" (
  "id"        text NOT NULL,
  "userId"    text NOT NULL DEFAULT 'default',
  "date"      text NOT NULL,
  "occasion"  text,
  "weather"   text,
  "notes"     text,
  "source"    text NOT NULL DEFAULT 'manual',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Outfit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Outfit_userId_date_idx" ON wearwhat."Outfit"("userId", "date");

CREATE TABLE IF NOT EXISTS wearwhat."OutfitItem" (
  "outfitId"       text NOT NULL,
  "clothingItemId" text NOT NULL,
  CONSTRAINT "OutfitItem_pkey" PRIMARY KEY ("outfitId", "clothingItemId"),
  CONSTRAINT "OutfitItem_outfitId_fkey" FOREIGN KEY ("outfitId")
    REFERENCES wearwhat."Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OutfitItem_clothingItemId_fkey" FOREIGN KEY ("clothingItemId")
    REFERENCES wearwhat."ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS wearwhat."WishlistItem" (
  "id"            text NOT NULL,
  "userId"        text NOT NULL DEFAULT 'default',
  "name"          text NOT NULL,
  "category"      text,
  "expectedPrice" double precision,
  "priority"      integer NOT NULL DEFAULT 0,
  "notes"         text,
  "createdAt"     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- ---- 受限账号授权（网关 ro/rw 账号；owner 自身无需 grant）----
GRANT USAGE ON SCHEMA wearwhat TO __RO__, __RW__;

-- ro：只读业务表
GRANT SELECT ON ALL TABLES IN SCHEMA wearwhat TO __RO__;

-- rw：增删改查（无任何 DDL/管理员权限）
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA wearwhat TO __RW__;

-- 以后在 wearwhat schema 新建的表自动带上同样权限
ALTER DEFAULT PRIVILEGES IN SCHEMA wearwhat GRANT SELECT ON TABLES TO __RO__;
ALTER DEFAULT PRIVILEGES IN SCHEMA wearwhat GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO __RW__;
