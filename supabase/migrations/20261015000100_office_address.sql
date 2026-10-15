-- Element — office address and the Google Maps link behind "Get directions".

update public.site_settings
set address  = '2330 Cambreleng Ave, Bronx, NY 10458',
    maps_url = 'https://www.google.com/maps/dir/?api=1&destination=2330+Cambreleng+Ave%2C+Bronx%2C+NY+10458'
where id;
