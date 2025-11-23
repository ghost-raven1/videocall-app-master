# Development stage
FROM node:20-alpine AS development

WORKDIR /app

# Копирование package.json и установка зависимостей
COPY package*.json ./
RUN npm ci

# Копирование исходного кода
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Production builder stage
FROM node:20-alpine AS builder

WORKDIR /app

# Копирование package.json и установка всех зависимостей
COPY package*.json ./
RUN npm ci

# Копирование исходного кода и сборка
COPY . .
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

# Удаление дефолтной конфигурации nginx
RUN rm /etc/nginx/conf.d/default.conf

# Копирование собранного приложения
COPY --from=builder /app/dist /usr/share/nginx/html

# Копирование кастомной конфигурации nginx для SPA
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
