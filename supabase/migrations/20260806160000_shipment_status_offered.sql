-- Carrier tender: broker assigns → offered; carrier accepts → assigned.

alter type public.shipment_status add value if not exists 'offered';
