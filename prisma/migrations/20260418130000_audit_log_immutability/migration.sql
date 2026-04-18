-- CreateFunction: prevent_audit_log_mutation
-- Enforces physical immutability on AuditLog table (MCA GSR 247(E) compliance).
-- Prevents any UPDATE or DELETE on AuditLog rows at the database level.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog rows are immutable — UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_audit_immutability
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
