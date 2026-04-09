# SN Shop Support Build

## Новое
- автопост товаров в Telegram-каналы магазинов
- веб-админка ролей
- бот-админка ролей через `/admin`
- улучшенная мобильная верстка Telegram WebApp
- кнопка `Пост в TG` в кабинете продавца

## ENV
Заполни `.env`:
- `BOT_TOKEN`
- `SUPPORT_BOT_TOKEN`
- `BASE_URL`
- `ADMIN_USERNAMES`
- `PORT=10000`
- `STORAGE_MODE=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET=sn-shop`
- `TRIPSHOP_CHANNEL_ID`
- `LIMBPL_CHANNEL_ID`
- `TRIPTOYS_CHANNEL_ID`
- `TRIPCHINASHOP_CHANNEL_ID`

Добавь основного бота админом в нужные каналы, иначе автопост не сработает.

## Команды
- `/start`
- `/admin`
- `/seller_add @username`
- `/support_add @username`
- `/role @username seller`
- `/role @username support`
- `/unrole @username seller`
- `/unrole @username support`
- `/roles`

## Поддержка
Пользователь с ролью `support` должен один раз нажать `/start` во втором support-боте.
