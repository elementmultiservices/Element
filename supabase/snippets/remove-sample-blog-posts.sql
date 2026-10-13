-- Element — removes the sample blog posts created by sample-blog-posts.sql.
-- Categories are kept (they may be in use); delete them from the admin if not needed.

delete from public.posts
 where id in (select post_id from public.post_translations where slug in ('prueba-propinas-y-horas-extra', 'test-tips-and-overtime', 'prueba-itin-vencido', 'test-expired-itin', 'prueba-citas-temporada', 'test-season-appointments', 'prueba-deposito-directo', 'test-direct-deposit', 'prueba-tramos-2027', 'test-brackets-2027', 'prueba-que-traer', 'test-what-to-bring', 'prueba-sales-tax-ny', 'test-ny-sales-tax', 'prueba-horario-feriado', 'test-holiday-hours', 'prueba-impuestos-estimados', 'test-estimated-taxes'));
