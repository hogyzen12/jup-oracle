// Required dependencies
// Install via: npm install axios fs web3 solana-web3.js child_process
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { Connection, Keypair, Transaction, SystemProgram, PublicKey, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');

// List of token addresses to track
const TOKENS = [
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "CLoUDKc4Ane7HeQcPpE3YHnznRxhMimJ4MyaUqyHFzAu",
    "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y",
    "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4"
];

// Directory for saving all data
const DATA_DIR = path.join(__dirname, 'token_data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Shadow Drive URL base
const SHDW_BASE_URL = 'https://shdw-drive.genesysgo.net/B29xPzw8AT4mNyvApZGHsfoh4G4TB6U2zFsxv1NZ9NvQ';

// Load keypair from local file
function loadKeypairFromFile(filePath) {
    const secretKeyString = fs.readFileSync(filePath, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
}

// Load payer keypair from local file
const payer = loadKeypairFromFile(path.join(__dirname, 'worKFoQQH5KzuBnmS3jKKYsJuUi5toCoEp7n4mwRtwa.json'));

// Function to fetch token prices
async function fetchPrices() {
    const url = 'https://api.jup.ag/price/v2';
    const params = {
        ids: TOKENS.join(','),
        showExtraInfo: 'true'
    };

    try {
        const response = await axios.get(url, { params });
        if (response.status === 200) {
            return response.data.data;
        } else {
            console.error(`Failed to fetch live prices: ${response.status}`, response.data);
            return null;
        }
    } catch (error) {
        console.error('Error fetching prices:', error);
        return null;
    }
}

// Function to store individual token data
function storeIndividualTokenData(token, priceData) {
    const timestamp = new Date().toISOString();

    // Create subdirectory for token
    const tokenDir = path.join(DATA_DIR, token);
    if (!fs.existsSync(tokenDir)) {
        fs.mkdirSync(tokenDir);
    }

    // Store the price data into individual JSON file
    const jsonFilename = path.join(tokenDir, `${token}_prices.json`);
    const priceEntry = {
        datetime: timestamp,
        data: priceData
    };

    let priceHistory = [];
    if (fs.existsSync(jsonFilename)) {
        const fileContent = fs.readFileSync(jsonFilename);
        priceHistory = JSON.parse(fileContent);
    }
    priceHistory.push(priceEntry);
    fs.writeFileSync(jsonFilename, JSON.stringify(priceHistory, null, 2));

    // Update Shadow Drive
    //updateShadowDrive(token, jsonFilename);
}

// Function to store master price data
function storeMasterPriceData(pricesData) {
    const timestamp = new Date().toISOString();
    const masterFilename = path.join(DATA_DIR, 'all_tokens_prices.json');

    const masterEntry = {
        datetime: timestamp
    };
    for (const token in pricesData) {
        masterEntry[token] = pricesData[token].price;
    }

    let masterHistory = [];
    if (fs.existsSync(masterFilename)) {
        const fileContent = fs.readFileSync(masterFilename);
        masterHistory = JSON.parse(fileContent);
    }
    masterHistory.push(masterEntry);
    fs.writeFileSync(masterFilename, JSON.stringify(masterHistory, null, 2));
}

// Function to send price data to Solana blockchain in a transaction memo
async function sendPriceDataToBlockchain(pricesData) {
    const rpcUrl = 'https://late-clean-snowflake.solana-mainnet.quiknode.pro/APIKEY/';
    const connection = new Connection(rpcUrl, 'confirmed');

    const sourcePubkey = payer.publicKey;
    const destinationPubkey = new PublicKey('FEEdUqbg1j4dzAcDigUTtUFJJEGBJ4DT6iyUaJFBgdwE');

    try {
        // Prepare memo data
        const memoData = {
            datetime: new Date().toISOString()
        };
        for (const token in pricesData) {
            memoData[token] = pricesData[token].price;
        }

        // Create transaction with memo data
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: sourcePubkey,
                toPubkey: destinationPubkey,
                lamports: 1 // Minimum lamport transfer to include memo
            }),
            new TransactionInstruction({
                keys: [
                    { pubkey: sourcePubkey, isSigner: true, isWritable: true }
                ],
                data: Buffer.from(JSON.stringify(memoData), 'utf-8'),
                programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
            })
        );

        // Send transaction
        const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
        console.log('Transaction sent with signature:', signature);
    } catch (error) {
        console.error('Error sending transaction:', error);
    }
}

// Function to update token prices on Shadow Drive
function updateShadowDrive(token, filePath) {
    if (token === 'all_tokens_prices') {
        return; // Skip updating 'all_tokens_prices' on Shadow Drive
    }
    const shdwUrl = `${SHDW_BASE_URL}/${token}_prices.json`;
    const rpcUrl = 'https://late-clean-snowflake.solana-mainnet.quiknode.pro/APIKEY/';
    const command = `shdw-drive edit-file -r ${rpcUrl} -kp ${path.join(__dirname, 'worKFoQQH5KzuBnmS3jKKYsJuUi5toCoEp7n4mwRtwa.json')} -f ${filePath} -u ${shdwUrl}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error updating Shadow Drive for ${token}:`, error.message);
            return;
        }
        if (stderr) {
            console.error(`Shadow Drive stderr for ${token}:`, stderr);
            return;
        }
        console.log(`Shadow Drive updated for ${token}:`, stdout);
    });
}

// Function to fetch prices every minute
async function fetchPricesEveryMinute() {
    while (true) {
        try {
            const now = new Date();
            const millisecondsUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
            await new Promise(resolve => setTimeout(resolve, millisecondsUntilNextMinute));

            const pricesData = await fetchPrices();
            if (pricesData) {
                storeMasterPriceData(pricesData);
                for (const token in pricesData) {
                    storeIndividualTokenData(token, pricesData[token]);
                }
                await sendPriceDataToBlockchain(pricesData);
                console.log(`Stored data for tokens at ${new Date().toISOString()}`);
            }
        } catch (error) {
            console.error('Error in fetchPricesEveryMinute:', error);
        }
    }
}

// Start the process
fetchPricesEveryMinute();

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
 