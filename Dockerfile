# Dockerfile for School Management System
# يعمل على أي منصة تدعم Docker

FROM oven/bun:1 AS base

WORKDIR /app

# نسخ ملفات package أولاً (للاستفادة من cache)
COPY package.json bun.lock ./

# تثبيت الحزم
RUN bun install --frozen-lockfile

# نسخ باقي الملفات
COPY . .

# توليد Prisma client + البناء
RUN bunx prisma generate && bun run build

# === مرحلة الإنتاج ===
FROM oven/bun:1 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=file:./db/custom.db

# نسخ الملفات الضرورية فقط
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static/
COPY --from=base /app/public ./public/
COPY --from=base /app/prisma ./prisma/
COPY --from=base /app/db ./db/
COPY --from=base /app/package.json ./
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma/
COPY --from=base /app/node_modules/@prisma ./node_modules/@prisma/
COPY --from=base /app/start.sh ./start.sh

RUN chmod +x start.sh

EXPOSE 3000

CMD ["./start.sh"]
