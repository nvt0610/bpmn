FROM node:20-alpine

RUN apk add --no-cache python3 make g++ pkgconfig expat-dev
ENV PYTHON=/usr/bin/python3 \
    npm_config_python=/usr/bin/python3

WORKDIR /app
COPY package*.json ./
RUN npm ci           # dùng ci cho build ổn định

COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]
