FROM node:lts-alpine AS builder
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public
EXPOSE 3000
RUN chown -R node /usr/src/app
USER node
CMD ["npm", "start"]
