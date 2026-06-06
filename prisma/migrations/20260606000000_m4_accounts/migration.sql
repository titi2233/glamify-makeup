-- AlterTable: agregar marketingConsent a Customer
ALTER TABLE "Customer" ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: agregar campos de recupero de carrito a Cart
ALTER TABLE "Cart" ADD COLUMN     "abandonedEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "recoveryEmailConsent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: tabla de redenciones de cupones por clienta
CREATE TABLE "CouponRedemption" (
    "customerId" UUID NOT NULL,
    "couponId" UUID NOT NULL,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "lastRedeemedAt" TIMESTAMP(3),

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("customerId","couponId")
);

-- CreateIndex: índice en couponId para búsquedas por cupón
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- CreateIndex: unique en Review para evitar reseñas duplicadas por clienta+producto
CREATE UNIQUE INDEX "Review_customerId_productId_key" ON "Review"("customerId","productId");

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
