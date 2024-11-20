// Dockerfile to Dockerize the app
/*
# Dockerfile

# Use an official Node.js runtime as a parent image
FROM node:16

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Run the app
CMD ["node", "app.js"]
*/

// To build and run the Docker container, use the following commands:
// docker build -t solana-price-tracker .
// docker run -d --restart always --name solana-price-tracker solana-price-tracker
