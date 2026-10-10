-- "Proprietário do contato" is the contact's own owner property in HubSpot —
-- distinct from owner_name (which comes from the deal, see 011). A contact
-- can have no deal yet and still have a contact owner assigned, or a deal
-- owned by someone other than the contact's own owner. Sem Atendimento needs
-- this field specifically: "IA handled them but nobody claimed the contact."
alter table public.hubspot_contacts
  add column if not exists contact_owner_id text,
  add column if not exists contact_owner_name text;
