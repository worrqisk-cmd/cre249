-- Number found in the source Telegram archive; confirm with Milana before public launch.
-- Preserve any value already entered by the owner and all other settings.
update public.site_settings
set whatsapp_number = '+7 (964) 203-48-35'
where id = true and nullif(btrim(whatsapp_number), '') is null;
