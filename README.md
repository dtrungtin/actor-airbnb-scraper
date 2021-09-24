# Airbnb Scraper

Airbnb Scraper actor is designed to extract most of publicly available data for home listings.
You can get all of the basic pieces of information about the listing and all of the reviews.

The actor was meant to be used for extracting all listings for a particular location.
You can specify the price range, checkin and checkout dates.
Normally Airbnb provides only the first 300 results on their website and limits the API to 1000 results, but with our Airbnb Scraper you can access all of them.
Because we divide the location into many smaller areas and also the price range into many smaller ranges to search, you will always see a lot of crawling pages comparing to the results and the run of this actor always take long time to complete. Please be patient to wait.

The actor can be used for various use cases.
You can monitor amount of Airbnb listings around your listing and get the newest prices updates and follow trends for the given location.
Another possible use case is to analyze reviews using sentiment analysis and find the best location in town.

## Get all listing for given location

It is super easy to get all Airbnb listings for a given location. If you are looking for more specific results, then you can also add `minPrice`, `maxPrice`, `checkIn`, `checkOut`,`currency`. Description of these fields can be found in the Input schema.
You have to only fill in the location field in the UI or pass the `INPUT` in the following shape:

```jsonc
{
  "locationQuery": "London"
}
```

## Get listing detail for specified list of urls

The only thing you have to do is provide a list of urls pointing to the Airbnb listing detail, for example:`https://www.airbnb.cz/rooms/31021739?adults=1&toddlers=0&check_in=2019-05-15&check_out=2019-05-23&guests=1&source_impression_id=p3_1557753504_RkhYbgY4jm9gY%2FVh&s=wUZdYw7_`

Also accept the shortened abnb.me urls, for example: `https://abnb.me/olPm75bhTY`

You can either use UI to pass the list of urls or you can specify the `INPUT` directly. In that case the file should like this:

```jsonc
{
  "startUrls":[
    {
      "url": "https://www.airbnb.cz/rooms/31021739?adults=1&toddlers=0&check_in=2019-05-15&check_out=2019-05-23&guests=1&source_impression_id=p3_1557753504_RkhYbgY4jm9gY%2FVh&s=wUZdYw7_"
    }
  ]
}
```

## Output

Output is stored in a dataset. Each item is an information about a listing detail. Example:

```jsonc
{
  "url": "https://www.airbnb.com/rooms/20840497",
  "name": "Koselig hytte i fredelige omgivelser",
  "stars": 5,
  "numberOfGuests": 9,
  "address": "Geilo, Buskerud, Norway",
  "roomType": "Entire cabin",
  "location": {
    "lat": 60.47574,
    "lng": 8.1929
  },
  "reviews": []
}
```

## Limitations

* Pricing information is only available when using the search, since requesting prices require v3 API version (and this uses v2)

## Compute units consumption

Keep in mind that it is much more efficient to run one longer scrape (at least one minute) than more shorter ones because of the startup time.

The average consumption is **1 Compute unit for 600 actor results** scraped

## Epilogue

Thank you for trying my actor. I will be very glad for a feedback that you can send to my email `dtrungtin@gmail.com`. If you find any bug, please create an issue on the [Github page](https://github.com/dtrungtin/actor-airbnb-scraper).
