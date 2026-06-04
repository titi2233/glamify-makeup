-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "compareAtPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "swatchHex" TEXT;
