-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "scopeId" UUID;

-- Secuencia para orderNumber humano (GLM-000123). Se consume con nextval() dentro de la tx de checkout.
CREATE SEQUENCE IF NOT EXISTS order_number_seq AS bigint START WITH 1 INCREMENT BY 1;
