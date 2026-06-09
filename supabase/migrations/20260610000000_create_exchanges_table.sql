create table exchanges (
  code          text primary key,
  label         text not null,
  region        text not null default 'Other',
  active        boolean not null default true,
  display_order integer not null default 999
);

alter table exchanges enable row level security;
create policy "read_all_authenticated" on exchanges for select to authenticated using (true);
create policy "admin_write" on exchanges for all to authenticated
  using  ((select role from user_settings where user_id = (auth.uid())::text) = 'admin')
  with check ((select role from user_settings where user_id = (auth.uid())::text) = 'admin');

insert into exchanges (code, label, region, display_order) values
  ('US',    'US · NYSE / NASDAQ',              'Americas',           10),
  ('TO',    'TSX · Toronto Stock Exchange',    'Americas',           11),
  ('SA',    'BOVESPA · São Paulo',             'Americas',           12),
  ('MX',    'BMV · Mexican Exchange',          'Americas',           13),
  ('LSE',   'LSE · London Stock Exchange',     'Europe',             20),
  ('XETRA', 'XETRA · Deutsche Börse',         'Europe',             21),
  ('PA',    'Euronext Paris',                  'Europe',             22),
  ('AS',    'Euronext Amsterdam',              'Europe',             23),
  ('BR',    'Euronext Brussels',               'Europe',             24),
  ('SW',    'SIX · Swiss Exchange',            'Europe',             25),
  ('MC',    'BME · Madrid Exchange',           'Europe',             26),
  ('ST',    'Nasdaq Nordic · Stockholm',       'Europe',             27),
  ('OL',    'Oslo Børs',                       'Europe',             28),
  ('CO',    'Nasdaq Copenhagen',               'Europe',             29),
  ('HE',    'Nasdaq Helsinki',                 'Europe',             30),
  ('IR',    'Euronext Dublin',                 'Europe',             31),
  ('HK',    'HKEX · Hong Kong Exchange',       'Asia-Pacific',       40),
  ('TSE',   'TSE · Tokyo Stock Exchange',      'Asia-Pacific',       41),
  ('SI',    'SGX · Singapore Exchange',        'Asia-Pacific',       42),
  ('AU',    'ASX · Australian Securities Exchange', 'Asia-Pacific',  43),
  ('NSE',   'NSE · National Stock Exchange India', 'Asia-Pacific',   44),
  ('BSE',   'BSE · Bombay Stock Exchange',     'Asia-Pacific',       45),
  ('KO',    'KRX · Korea Stock Exchange',      'Asia-Pacific',       46),
  ('KQ',    'KOSDAQ · Korea',                  'Asia-Pacific',       47),
  ('TW',    'TWSE · Taiwan Stock Exchange',    'Asia-Pacific',       48),
  ('BK',    'SET · Thailand Exchange',         'Asia-Pacific',       49),
  ('JK',    'IDX · Jakarta Exchange',          'Asia-Pacific',       50),
  ('KLSE',  'Bursa · Kuala Lumpur',            'Asia-Pacific',       51),
  ('SHG',   'SSE · Shanghai Stock Exchange',   'Asia-Pacific',       52),
  ('SHE',   'SZSE · Shenzhen Stock Exchange',  'Asia-Pacific',       53),
  ('TA',    'TASE · Tel Aviv',                 'Middle East & Africa', 60),
  ('JSE',   'JSE · Johannesburg',              'Middle East & Africa', 61);
