# Станція на ПК

| Процес | Команда | Порт | Що робить |
|--------|---------|------|-----------|
| **compute** | `npm run compute` | 3850 | збір, БД, аналіз |
| **api** | `npm run api` | 3848 | бек сайту |
| **web** | `npm run web` | 3847 | сайт |
| **bt** | `npm run bt -- COM11` | — | USB з годинника → compute |

```bash
npm run compute
npm run api
npm run web
npm run bt -- COM11
```

Сайт: http://localhost:3847  

**Закрий Arduino Serial Monitor** — інакше COM11 зайнятий і плитка лишається «очікування».
