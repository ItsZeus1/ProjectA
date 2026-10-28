/**
 * Tiny browser-event bridge so the navbar and the service cards can open the
 * admin service form / delete confirmation without prop drilling.
 * The listeners live in components/ServiceFormModal.tsx (Phase 5).
 */
export const SERVICE_FORM_EVENT = "novacharge:service-form";
export const SERVICE_DELETE_EVENT = "novacharge:service-delete";

export type ServiceFormEventDetail = { mode: "create" } | { mode: "edit"; slug: string };
export type ServiceDeleteEventDetail = { slug: string; name: string };

export function openServiceForm(detail: ServiceFormEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ServiceFormEventDetail>(SERVICE_FORM_EVENT, { detail }));
}

export function requestServiceDelete(detail: ServiceDeleteEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ServiceDeleteEventDetail>(SERVICE_DELETE_EVENT, { detail }));
}
