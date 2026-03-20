# Uptime Alerts

Node.js сервис для мониторинга сайтов и серверов с уведомлениями в Telegram.

## Что умеет

- проверяет сайты и health-эндпоинты серверов обычным HTTP(S) запросом;
- проверяет TLS-сертификаты для сервисов типа `website`;
- шлет уведомления в Telegram при падении сервиса, восстановлении и проблемах с сертификатом;
- читает список проверок из JSON-файла.

## Требования

- Node.js 20+

## Установка

```bash
npm install
cp .env.example .env
cp services.example.json services.json
```

## Настройка `.env`

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
SERVICES_CONFIG_PATH=./services.json
CHECK_INTERVAL_MS=60000
REQUEST_TIMEOUT_MS=10000
CERTIFICATE_WARNING_DAYS=10
```

## Формат `services.json`

```json
{
  "services": [
    {
      "name": "Main website",
      "type": "website",
      "url": "https://example.com"
    },
    {
      "name": "Backend health",
      "type": "server",
      "url": "http://187.34.212.13/health"
    }
  ]
}
```

Типы:

- `website` - делает HTTP(S) запрос и дополнительно проверяет сертификат, если URL на `https`.
- `server` - делает HTTP(S) запрос по указанному health URL.

## Запуск

```bash
npm start
```

## Docker

Локальный запуск через Docker Compose:

```bash
docker compose up -d
```

Для контейнера нужны два файла рядом с `docker-compose.yml`:

- `.env`
- `services.json`

## CI/CD

Репозиторий настроен по той же схеме, что и в `dzera-bot`:

- `CI`: запускается на `push` и `pull_request` в `master` и `develop`, выполняет `npm ci` и `npm run check`
- `Deploy`: запускается на `push` в `master`, собирает Docker image, пушит его в Docker Hub и по SSH обновляет контейнер на сервере

### GitHub Secrets

Для `Deploy` нужны секреты:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`

### Что должно лежать на сервере

В каталоге `/home/uptime-alerts`:

- `.env`
- `services.json`
- `docker-compose.yml`

После этого деплой workflow сам выполнит `docker compose pull` и `docker compose up -d`.

## Логика алертов

- при первом неуспешном ответе приходит сообщение о проблеме;
- при восстановлении приходит сообщение о восстановлении;
- если сертификат истекает меньше чем через `CERTIFICATE_WARNING_DAYS`, приходит предупреждение;
- повторные одинаковые уведомления не шлются на каждом цикле.
