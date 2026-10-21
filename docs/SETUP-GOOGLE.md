# Доступ к Google Drive для синхронизации

Около 15 минут, один раз, на ПК. Приложение получит доступ **только к скрытой папке приложения** в вашем Google Drive (scope `drive.appdata`). Ваши обычные файлы ему недоступны, а сама папка не видна в интерфейсе Drive.

Названия пунктов в консоли Google иногда меняются. Если что-то не совпадает, Claude Code подскажет по скриншоту.

## 1. Проект

1. Откройте console.cloud.google.com и войдите аккаунтом, на Drive которого будет синхронизация.
2. Вверху выберите проект → **New project**. Имя: `zdorovie` → **Create**.

## 2. Включить Drive API

**APIs & Services → Library** → найдите **Google Drive API** → **Enable**.

## 3. Экран согласия (Google Auth Platform)

1. **APIs & Services → OAuth consent screen** (или **Google Auth Platform**) → **Get started**.
2. App name: `Здоровье`. Support email: ваш.
3. Audience: **External**.
4. Контакт разработчика: ваш email → **Create**.
5. **Audience → Test users → Add users** → ваш email. Приложение остаётся в режиме **Testing**: пользоваться им будете только вы, проверка Google не нужна.
6. **Data access → Add or remove scopes** → вручную добавьте `https://www.googleapis.com/auth/drive.appdata` → **Update → Save**.

## 4. Два клиента

**Clients → Create client**:

| Клиент | Тип | Что заполнить |
|---|---|---|
| Для iPhone и браузера | **Web application** | Authorized JavaScript origins: `https://rastaskin.github.io`. Authorized redirect URIs: `https://rastaskin.github.io/zdorovie/` |
| Для ПК | **Desktop app** | Ничего, только имя |

Скопируйте **Client ID** обоих клиентов и передайте их Claude Code: это не секрет, они лягут в `web/config.js`.

**Client secret** Desktop-клиента в чат не вставляйте. Положите его сразу в Secrets репозитория, команда спросит значение:

```
gh secret set GOOGLE_DESKTOP_CLIENT_SECRET -R rastaskin/zdorovie
```

Сборка установщика подставит его только в приложение для ПК. В репозитории и на сайте его не будет.

## Что важно знать

- В режиме Testing Google может раз в неделю просить войти заново. Это одно касание.
- Если отключить доступ (myaccount.google.com → Безопасность → Сторонние приложения), синхронизация остановится, а данные на устройствах останутся.
- В облаке хранится только шифр. Без кодовой фразы или ключа восстановления его не прочитает ни Google, ни кто-либо ещё.
