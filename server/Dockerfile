FROM node:18-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 8080

# Start server
CMD ["npm", "run", "dev"]
