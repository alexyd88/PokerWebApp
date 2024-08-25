FROM node:16

WORKDIR /app

ENV NODE_ENV=development
COPY backend/package*.json backend/
RUN npm ci --prefix backend

COPY . .


ENV NODE_ENV=production
EXPOSE 8080
CMD npm start --prefix backend