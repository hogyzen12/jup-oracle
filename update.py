import aiohttp
import asyncio
import pandas as pd
from datetime import datetime, timezone
import os
import json

# List of token addresses to track
TOKENS = [
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "CLoUDKc4Ane7HeQcPpE3YHnznRxhMimJ4MyaUqyHFzAu",
    "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y",
    "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4"
]

# Directory for saving all data
DATA_DIR = "token_data"
os.makedirs(DATA_DIR, exist_ok=True)

async def fetch_prices(session: aiohttp.ClientSession):
    """
    Fetch the prices and extra info of all tokens from the Jupiter Price API.
    """
    url = "https://api.jup.ag/price/v2"
    params = {
        "ids": ','.join(TOKENS),  # Combine all token addresses in a comma-separated string
        "showExtraInfo": "true"
    }

    try:
        async with session.get(url, params=params) as response:
            if response.status == 200:
                data = await response.json()
                return data.get('data', {})
            else:
                print(f"Failed to fetch live prices: {response.status}, Response: {await response.text()}")
                return None
    except Exception as e:
        print(f"Error fetching prices: {str(e)}")
        return None

def store_master_price_data(prices_data):
    """
    Store prices for all tokens into a master CSV file where each column is a token.
    """
    master_filename = os.path.join(DATA_DIR, "all_tokens_prices.csv")
    timestamp = datetime.now(timezone.utc)

    # Prepare the row where each token is a column
    master_data = {
        "datetime": timestamp
    }
    for token, price_data in prices_data.items():
        master_data[token] = price_data['price']

    # Convert to DataFrame
    master_df = pd.DataFrame([master_data])

    # Write or append to the master CSV
    master_df.to_csv(master_filename, mode='a', header=not os.path.exists(master_filename), index=False)

def store_individual_token_data(token, price_data):
    """
    Store individual token price in a CSV file and store the full info in a JSON file.
    """
    timestamp = datetime.now(timezone.utc)

    # Create subdirectory for token
    token_dir = os.path.join(DATA_DIR, token)
    os.makedirs(token_dir, exist_ok=True)

    # Store the price data into individual CSV files
    price_info = {
        "datetime": timestamp,
        "price": price_data['price']
    }
    
    price_filename = os.path.join(token_dir, f"{token}_prices.csv")
    price_df = pd.DataFrame([price_info])
    price_df.to_csv(price_filename, mode='a', header=not os.path.exists(price_filename), index=False)

    # Store the full response as JSON
    json_filename = os.path.join(token_dir, f"{token}_full_info.json")
    with open(json_filename, 'a') as json_file:
        json.dump({"datetime": str(timestamp), "data": price_data}, json_file)
        json_file.write('\n')

async def fetch_prices_every_minute():
    """
    Fetch prices every minute and store the data.
    """
    async with aiohttp.ClientSession() as session:
        while True:
            now = datetime.now()
            # Sleep until the next full minute
            seconds_until_next_minute = 60 - now.second
            await asyncio.sleep(seconds_until_next_minute)
            
            # Fetch the token prices
            prices_data = await fetch_prices(session)
            
            if prices_data:
                # Store data for each token
                store_master_price_data(prices_data)
                for token, price_data in prices_data.items():
                    store_individual_token_data(token, price_data)
                    print(f"Stored data for {token} at {datetime.now(timezone.utc)}")

# Entry point for the bot
if __name__ == "__main__":
    asyncio.run(fetch_prices_every_minute())
