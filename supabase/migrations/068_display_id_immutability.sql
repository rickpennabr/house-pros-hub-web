-- Enforce immutable display IDs after insert.
-- Service role can override for controlled admin repair operations.

CREATE OR REPLACE FUNCTION public.prevent_display_id_change_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.display_id IS DISTINCT FROM OLD.display_id THEN
    IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
      RAISE EXCEPTION 'display_id is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_businesses_prevent_display_id_change ON public.businesses;
CREATE TRIGGER tr_businesses_prevent_display_id_change
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_display_id_change_trigger();

DROP TRIGGER IF EXISTS tr_pro_crm_customers_prevent_display_id_change ON public.pro_crm_customers;
CREATE TRIGGER tr_pro_crm_customers_prevent_display_id_change
  BEFORE UPDATE ON public.pro_crm_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_display_id_change_trigger();

DROP TRIGGER IF EXISTS tr_pro_crm_estimates_prevent_display_id_change ON public.pro_crm_estimates;
CREATE TRIGGER tr_pro_crm_estimates_prevent_display_id_change
  BEFORE UPDATE ON public.pro_crm_estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_display_id_change_trigger();

DROP TRIGGER IF EXISTS tr_pro_crm_invoices_prevent_display_id_change ON public.pro_crm_invoices;
CREATE TRIGGER tr_pro_crm_invoices_prevent_display_id_change
  BEFORE UPDATE ON public.pro_crm_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_display_id_change_trigger();

DROP TRIGGER IF EXISTS tr_pro_crm_projects_prevent_display_id_change ON public.pro_crm_projects;
CREATE TRIGGER tr_pro_crm_projects_prevent_display_id_change
  BEFORE UPDATE ON public.pro_crm_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_display_id_change_trigger();

DROP TRIGGER IF EXISTS tr_pro_crm_tasks_prevent_display_id_change ON public.pro_crm_tasks;
CREATE TRIGGER tr_pro_crm_tasks_prevent_display_id_change
  BEFORE UPDATE ON public.pro_crm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_display_id_change_trigger();

DROP TRIGGER IF EXISTS tr_pro_crm_expenses_prevent_display_id_change ON public.pro_crm_expenses;
CREATE TRIGGER tr_pro_crm_expenses_prevent_display_id_change
  BEFORE UPDATE ON public.pro_crm_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_display_id_change_trigger();

DROP TRIGGER IF EXISTS tr_pro_crm_items_prevent_display_id_change ON public.pro_crm_items;
CREATE TRIGGER tr_pro_crm_items_prevent_display_id_change
  BEFORE UPDATE ON public.pro_crm_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_display_id_change_trigger();

DROP TRIGGER IF EXISTS tr_admin_notification_events_prevent_display_id_change ON public.admin_notification_events;
CREATE TRIGGER tr_admin_notification_events_prevent_display_id_change
  BEFORE UPDATE ON public.admin_notification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_display_id_change_trigger();
