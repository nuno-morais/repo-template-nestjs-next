FROM node:24-alpine

WORKDIR /app

COPY . .

RUN yarn install --frozen-lockfile

EXPOSE 3000

CMD ["yarn", "start:dev"]
