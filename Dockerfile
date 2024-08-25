FROM node:16

WORKDIR /app

ENV NODE_ENV=development
COPY game_logic/package*.json game_logic/
RUN npm ci --prefix game_logic
COPY backend/package*.json backend/
RUN npm ci --prefix backend

COPY . .
RUN npm run buildForBackend --prefix game_logic


ENV NODE_ENV=production
EXPOSE 8080
CMD npm start --prefix backend