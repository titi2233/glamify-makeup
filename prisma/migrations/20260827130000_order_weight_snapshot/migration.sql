-- AddColumn: peso total del pedido snapshoteado al checkout, en gramos.
-- Lo usa el envío automático a MiCorreo (POST /shipping/import) para no recalcular
-- desde las variantes (que pueden cambiar de peso después de la compra).
ALTER TABLE "Order" ADD COLUMN "weightGr" INTEGER NOT NULL DEFAULT 0;
