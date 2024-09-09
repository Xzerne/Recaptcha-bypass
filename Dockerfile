FROM node:14

# Install Chromium
RUN apt-get update && \
    apt-get install -y wget ca-certificates && \
    wget https://chromedriver.storage.googleapis.com/100.0.4896.60/chromedriver_linux64.zip && \
    unzip chromedriver_linux64.zip -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/chromedriver && \
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    dpkg -i google-chrome-stable_current_amd64.deb && \
    apt-get -f install -y

# Install dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Copy source code
COPY . .

# Run your application
CMD ["node", "index.js"]
