-- Run after the migration. Re-running leaves owner edits untouched.
insert into public.categories (id, label, sort_order) values
('savory', 'Несладкие пироги', 10),
('sweet', 'Сладкие пироги', 20),
('cakes', 'Торты', 30),
('desserts', 'Десерты и зефир', 40)
on conflict (id) do nothing;

insert into public.site_settings (id, city, whatsapp_number, telegram_username, delivery_text)
values (true, 'Москва', null, null, 'Способ получения и удобное время согласуем при заказе.')
on conflict (id) do nothing;

insert into public.products
(slug, title, description, category_id, fillings, photos, sort_order, featured, published) values
('forel-brokkoli', 'Пирог с форелью и брокколи', '', 'savory', '{}', '[]', 10, false, true),
('myasnoy', 'Мясной пирог с картошкой и зеленью', '', 'savory', '{}', '[{"static":"photos/06_myasnoy_pirog.jpg","desktop":"50% 50%","mobile":"50% 50%"}]', 20, true, true),
('kurnik', 'Курник', '', 'savory', '{}', '[{"static":"photos/05_kurnik.jpg","desktop":"50% 50%","mobile":"50% 50%"}]', 30, true, true),
('tvorozhno-syrny', 'Творожно-сырный пирог с зелёным луком и укропом', '', 'savory', '{}', '[{"static":"photos/07_tvorozhny_pirog_s_zelenyu.jpg","desktop":"50% 50%","mobile":"50% 50%"}]', 40, false, true),
('assorti', 'Пирог «Ассорти»', 'Сладкий пирог, в котором можно сочетать разные начинки.', 'sweet', array['Творог','Клубника','Малина','Манго-маракуйя','Орехи'], '[{"static":"photos/02_pirog_assorti.jpg","desktop":"50% 50%","mobile":"50% 45%"}]', 50, true, true),
('slivochno-karamelny', 'Сливочно-карамельный пирог', '', 'sweet', '{}', '[{"static":"photos/03_slivochno_karamelny_pirog.jpg","desktop":"50% 50%","mobile":"50% 50%"}]', 60, true, true),
('kuraga-oreh', 'Двухслойный пирог с курагой и грецким орехом', '', 'sweet', '{}', '[{"static":"photos/04_pirog_kuraga_orehi.jpg","desktop":"50% 50%","mobile":"50% 50%"}]', 70, false, true),
('molochnaya-devochka', 'Торт «Молочная девочка»', '', 'cakes', '{}', '[{"static":"photos/12_molochnaya_devochka.jpg","desktop":"50% 60%","mobile":"50% 62%"}]', 80, false, true),
('milka', 'Торт «Милка»', 'Шоколадные бисквитные коржи и крем, напоминающий пломбир с молочным шоколадом.', 'cakes', '{}', '[{"static":"photos/08_tort_milka.jpg","desktop":"50% 35%","mobile":"50% 30%"}]', 90, true, true),
('orehovy', 'Ореховый торт', '', 'cakes', '{}', '[{"static":"photos/11_orehovy_tort.jpg","desktop":"50% 55%","mobile":"50% 55%"}]', 100, false, true),
('medovik', 'Медовик', '', 'cakes', '{}', '[{"static":"photos/01_hero_medovik.jpg","desktop":"50% 40%","mobile":"55% 40%"}]', 110, true, true),
('merengovy-rulet', 'Меренговый рулет', '', 'desserts', '{}', '[{"static":"photos/09_merengovy_rulet.jpg","desktop":"50% 50%","mobile":"50% 50%"}]', 120, true, true),
('tart', 'Тарт фруктово-ягодный', '', 'desserts', '{}', '[]', 130, false, true),
('zefirnye-tsvety', 'Зефирные цветы', '', 'desserts', '{}', '[{"static":"photos/10_zefirnye_tsvety.jpg","desktop":"50% 50%","mobile":"50% 50%"}]', 140, true, true),
('pechenochny', 'Печёночный торт', '', 'cakes', '{}', '[]', 150, false, false)
on conflict (slug) do nothing;
