-- CreateEnum: estados de una solicitud de arrepentimiento
CREATE TYPE "RetractionStatus" AS ENUM ('pending', 'processed', 'rejected');

-- CreateTable: solicitudes del Botón de Arrepentimiento (Res. 424/2020, art. 34 Ley 24.240)
CREATE TABLE "RetractionRequest" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "orderNumber" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "reason" TEXT,
    "status" "RetractionStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetractionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: constancia única (ARR-000123 se deriva de seq)
CREATE UNIQUE INDEX "RetractionRequest_seq_key" ON "RetractionRequest"("seq");

-- CreateIndex: filtro por estado en el panel/seguimiento
CREATE INDEX "RetractionRequest_status_idx" ON "RetractionRequest"("status");
