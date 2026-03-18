FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY app.js server.js index.html styles.css README.md ./
COPY supabase ./supabase

RUN mkdir -p data/uploads

EXPOSE 4173

CMD ["node", "server.js"]
