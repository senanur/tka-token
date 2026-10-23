FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY shared ./shared
COPY server ./server
COPY public ./public
ENV PORT=8080 DATA_FILE=/app/data/state.json
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME /app/data
EXPOSE 8080
USER node
CMD ["node", "server/server.js"]
