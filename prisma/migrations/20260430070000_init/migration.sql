-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('parsed', 'failed');

-- CreateEnum
CREATE TYPE "RouteReviewStatus" AS ENUM ('draft', 'in_review', 'confirmed');

-- CreateEnum
CREATE TYPE "StopStatus" AS ENUM ('pending', 'arrived', 'skipped', 'issue');

-- CreateTable
CREATE TABLE "DeliveryImport" (
    "id" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'parsed',

    CONSTRAINT "DeliveryImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDay" (
    "id" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',

    CONSTRAINT "DeliveryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "importId" TEXT,
    "deliveryDayId" TEXT NOT NULL,
    "driverId" TEXT,
    "routeName" TEXT NOT NULL,
    "status" "RouteReviewStatus" NOT NULL DEFAULT 'draft',
    "firstEtaLocal" TEXT,
    "lastEtaLocal" TEXT,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "itemSummary" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "deliveryDayId" TEXT NOT NULL,
    "orderId" TEXT,
    "sequence" INTEGER NOT NULL,
    "fullAddress" TEXT NOT NULL,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "etaLocal" TEXT,
    "actualArrivalLocal" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "deliveryTip" TEXT,
    "dispatcherMemo" TEXT,
    "status" "StopStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTip" (
    "id" TEXT NOT NULL,
    "stopId" TEXT,
    "routeId" TEXT,
    "addressFingerprint" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteReviewLog" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "status" "RouteReviewStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDay_serviceDate_key" ON "DeliveryDay"("serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_name_key" ON "Driver"("name");

-- CreateIndex
CREATE INDEX "Route_deliveryDayId_routeName_idx" ON "Route"("deliveryDayId", "routeName");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "RouteStop_deliveryDayId_idx" ON "RouteStop"("deliveryDayId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_sequence_key" ON "RouteStop"("routeId", "sequence");

-- CreateIndex
CREATE INDEX "DeliveryTip_addressFingerprint_idx" ON "DeliveryTip"("addressFingerprint");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_importId_fkey" FOREIGN KEY ("importId") REFERENCES "DeliveryImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_deliveryDayId_fkey" FOREIGN KEY ("deliveryDayId") REFERENCES "DeliveryDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_deliveryDayId_fkey" FOREIGN KEY ("deliveryDayId") REFERENCES "DeliveryDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTip" ADD CONSTRAINT "DeliveryTip_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "RouteStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTip" ADD CONSTRAINT "DeliveryTip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteReviewLog" ADD CONSTRAINT "RouteReviewLog_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

