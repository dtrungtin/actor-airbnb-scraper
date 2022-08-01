
## What does Airbnb Scraper do?
This scraper can extract all listings for a particular area and all details for a particular Airbnb listing. Airbnb usually only provides the first 300 results on the website and limits the API to 1,000 results. But with our unofficial Airbnb API, you can access all possible results. Now you can: 

- get all **Airbnb listings from one location**: rating, price, number of guests, location details, indicated address, URL, reviews.
- **extract all Airbnb reviews** from one listing: initial comments, responses, name, rating, language, author ID, posting time, and lots more.
- **get Airbnb prices** in various currencies.
- specify price range, check-in, and check-out dates. 
- scrape listings one by one or by pasting an external link with a list of URLs to scrape (CSV, Google Sheets).

## How much does it cost to scrape Airbnb?
Running Airbnb Scraper once will get you  **1,000 results for less than USD 1 in Apify platform credits**. For more details about the plans we offer, platform credits, and usage, see the [platform pricing page](https://apify.com/pricing/actors) or this video guide on &#9655; [how to choose the right subscription plan](https://www.youtube.com/watch?v=s_89WpOsKRI). 

## How to scrape Airbnb data
For a step-by-step guide on how to scrape Airbnb, follow our [Airbnb Scraper tutorial](
https://blog.apify.com/how-to-scrape-airbnb-listings-and-reviews/
). 

## How can you use scraped Airbnb data?
-  **Monitor Airbnb listings** in your chosen location and get the newest prices updates.
- **Predict prices** for the given location for the upcoming tourist season.
- **Find emerging trends** and gain **competitive intelligence** for the travel industry and adapt your own pricing.
- **Analyze customer expectations** and preferences in terms of price range, housing size, features, available infrastructure, and much more.  
- **Analyze reviews** using sentiment analysis to identify the most successful locations in town.
- Narrow down **emerging popular locations to target** with the new touring or lodging offers.
- **Support your decisions with data** when deciding to open pr visit a new spot away from most popular destinations.

## How to scrape Airbnb Destination or Airbnb Place
There are two ways you can scrape Airbnb: either by Destination or by Place.
 1. Scraping **by Destination** will get you data from Airbnb search results page. You'll get main info on all available listings in any city or town. 
 2. Scraping **by Place** will get you all details from a single rental listing (reviews, price, availability). You can add as many listings as you want.
 
### How to scrape all Airbnb listings in an area
It's super easy to get all Airbnb listings by Destination. Just enter the city name as you would do it in and Airbnb search, then indicate the number of results you want to scrape. 

![Apify  -  Airbnb  Scraper  input](https://i.imgur.com/BDyPlHa.png)

Here's its equivalent in JSON:
```json
{
  "locationQuery": "Sacramento, California",
  "maxListings": 200,
  "simple": true,
  "includeReviews": true,
  "maxReviews": 10,
  "calendarMonths": 0,
  "addMoreHostInfo": false,
  "currency": "USD",
  "proxyConfiguration": {
    "useApifyProxy": true
  },
  "maxConcurrency": 50,
  "limitPoints": 100,
  "timeoutMs": 60000,
  "debugLog": false,
  "minPrice": 20,
  "maxPrice": 200,
  "checkIn": "2022-08-09"
}
```

### How to scrape all details from a single rental listing 
It is also easy to get all details for a specific listing. Just enter the URL of the home listing you want to scrape. Note that this parameter only accepts *direct* listing URLs. Using this field, you can:
- scrape just one URL (one Airbnb listing).
- scrape multiple URLs in parallel by adding more URL fields.
- for convenience, instead of adding multiple URL fields, you can also paste a link to Google Sheets or a CSV containing the list of your URLs.
- paste original or shortened abnb.me URLs.


![Apify  -  Airbnb  Scraper  input](https://i.imgur.com/TXNXcS2.png[)

Here's its equivalent in JSON:
```json
{
  "simple": true,
  "includeReviews": true,
  "maxReviews": 10,
  "calendarMonths": 0,
  "addMoreHostInfo": true,
  "currency": "USD",
  "proxyConfiguration": {
    "useApifyProxy": true
  },
  "maxConcurrency": 50,
  "limitPoints": 100,
  "timeoutMs": 60000,
  "debugLog": false,
  "minPrice": 20,
  "maxPrice": 200,
  "checkIn": "2022-08-09",
  "startUrls": [
    {
      "url": "https://www.airbnb.com/rooms/30692949"
    }
  ],
  "maxListings": 200
}
```

For the full list of optional parameters, their default values, and how to set the values of your own, see the [Input Schema tab](https://apify.com/dtrungtin/airbnb-scraper/input-schema).

##  Airbnb data output 
The output from Airbnb Scraper is stored in the dataset. After the run is finished, you can download the dataset in various data formats (JSON, CSV, XML, RSS, HTML Table).

### Output example (scrape by Destination)
```json
[{
  "url": "https://www.airbnb.com/rooms/28763257",
  "name": "Jersey city home near NYC",
  "stars": 5,
  "numberOfGuests": 1,
  "address": "Jersey City, New Jersey, United States",
  "roomType": "Private room in residential home",
  "location": {
    "lat": 40.75413,
    "lng": -74.0459
  },
  "reviews": [
    {
      "author": {
        "firstName": "Vincent",
        "hasProfilePic": true,
        "id": 134711443,
        "pictureUrl": "https://a0.muscache.com/im/pictures/user/3a5275dd-a2be-4ef5-ac80-27701457c15d.jpg?aki_policy=profile_x_medium",
        "smartName": "Vincent",
        "thumbnailUrl": "https://a0.muscache.com/im/pictures/user/3a5275dd-a2be-4ef5-ac80-27701457c15d.jpg?aki_policy=profile_small"
      },
      "authorId": 134711443,
      "canBeEdited": false,
      "comments": "Great place to stay with lots of unexpected bonuses: the rainforest shower head in the bathroom; huge kitchen; lovely size room with its own key; tons of closet space with an iron and ironing board if needed; a TV with a playstation; it's all there. There's three different bus lines within five blocks of the place that will take you to NYC if you need, and there's lots of nice restaurants nearby as well. Andre's brother Ryan kept in touch with me every step of the way, and I'd gladly stay there again.",
      "createdAt": "2021-12-22T21:15:32Z",
      "id": 523205305261485500,
      "idStr": "523205305261485506",
      "listingId": 28763257,
      "recipientId": 216962688,
      "collectionTag": null,
      "listing": {
        "id": 28763257,
        "listingIdStr": "28763257",
        "name": "Jersey city home near NYC"
      },
      "rating": 5,
      "recipient": {
        "firstName": "Andre",
        "hasProfilePic": true,
        "id": 216962688,
        "pictureUrl": "https://a0.muscache.com/im/pictures/user/03e6a979-1d2d-4de4-a45f-62ec8a21dcee.jpg?aki_policy=profile_x_medium",
        "smartName": "Andre",
        "thumbnailUrl": "https://a0.muscache.com/im/pictures/user/03e6a979-1d2d-4de4-a45f-62ec8a21dcee.jpg?aki_policy=profile_small"
      },
      "response": "",
      "role": "guest",
      "language": "en",
      "userFlag": null
    },
    {
      "author": {
        "firstName": "Gc",
        "hasProfilePic": true,
        "id": 364784396,
        "pictureUrl": "https://a0.muscache.com/im/pictures/user/fde71470-659d-4e97-b731-b9b9851061e3.jpg?aki_policy=profile_x_medium",
        "smartName": "Gc",
        "thumbnailUrl": "https://a0.muscache.com/im/pictures/user/fde71470-659d-4e97-b731-b9b9851061e3.jpg?aki_policy=profile_small"
      },
      "authorId": 364784396,
      "canBeEdited": false,
      "comments": "Honestly, best Airbnb place I’ve ever stayed at. Andre and intan and Andre’s brother were very welcoming and provided the best service but also it was very nice to come back to the house after a long day getting to know New York and just having a chat with Andre. He helped me find restaurants to try out and gave me direction on how to get to certain places. Loved their 3 dogs and cat, very friendly. Can’t thank you guys enough for making my first trip to New York/ New Jersey even better.",
      "createdAt": "2021-12-13T20:18:25Z",
      "id": 516653570169077060,
      "idStr": "516653570169077058",
      "listingId": 28763257,
      "recipientId": 216962688,
      "collectionTag": null,
      "listing": {
        "id": 28763257,
        "listingIdStr": "28763257",
        "name": "Jersey city home near NYC"
      },
      "rating": 5,
      "recipient": {
        "firstName": "Andre",
        "hasProfilePic": true,
        "id": 216962688,
        "pictureUrl": "https://a0.muscache.com/im/pictures/user/03e6a979-1d2d-4de4-a45f-62ec8a21dcee.jpg?aki_policy=profile_x_medium",
        "smartName": "Andre",
        "thumbnailUrl": "https://a0.muscache.com/im/pictures/user/03e6a979-1d2d-4de4-a45f-62ec8a21dcee.jpg?aki_policy=profile_small"
      },
      "response": "Whenever you plan to come again to the east coast please come by and visit!. You are always welcomed here bro. Thank you for your good vibes! Really hope to see you again!",
      "role": "guest",
      "language": "en",
      "userFlag": null
    },
```

## Limitations
-  In order to accomplish the run, the scraper mainly splits the location into smaller areas and divides the price range into smaller ranges. Because of this approach, you might see more crawling pages compared to the results you get, and the run of this actor might take longer to complete. 
-  *Airbnb Places* field will only scrape from a URL of a specific listing. This parameter cannot be used for other URLs, such as search result URL, for instance. 

## Other travel scrapers
We have other tourism-related scrapers for you to try, such as [Booking Scraper](https://apify.com/dtrungtin/booking-scraper) and [Tripadvisor Scraper](https://apify.com/maxcopell/tripadvisor). If you're interested in those, browse the [Travel Category](https://apify.com/store?category=TRAVEL) in Apify Store.

## Your feedback
We're always striving to improve the performance of our actors. To give us technical feedback about Airbnb Scraper or to report a bug, please create an issue on the  [GitHub page](https://github.com/dtrungtin/actor-airbnb-scraper) or email us at  `support@apify.com` and we'll get to it.
