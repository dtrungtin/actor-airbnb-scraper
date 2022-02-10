
Airbnb Scraper is designed to extract most of the publicly available Airbnb data for home listings. You can get all of the basic data about the listing, all reviews, prices, host/guest details, etc.

## What does Airbnb Scraper do?

This scraper will extract all listings for a particular location. Typically, Airbnb will provide only the first 300 results on their website and limit the API to 1000 results. But with our Unofficial Airbnb API, you can access all of them. Now you can: 

- get all **Airbnb listings from one location**: rating, price, number of guests, location details, indicated address, URL, reviews.
- specify the price range, check-in, and check-out dates. 
- **scrape Airbnb prices** in various currencies.
- **extract all Airbnb reviews** from one listing: initial comments, responses, name, rating, language, author ID, posting time, etc.
- scrape by input schema parameters or by using an external link with a list of URLs to scrape (CSV, Google Sheets).

## Cost of usage

Following our basic plan, one Airbnb Scraper run will get you  **1,000 results for less than 1 USD credits**. For more details about the plans we offer, platform credits, and usage, see the  [platform pricing page](https://apify.com/pricing/actors).

If you're not sure how much credit you've got on your plan and whether you might need to upgrade, you can always check your limits in the  _Settings_  ->  _Usage and Billing_  tab in  [your Console](https://console.apify.com/). The easiest way to know how many credits your actor will need is to perform a *test run*.

## Tutorial 

For a step-by-step guide on how to scrape Airbnb, just follow our [Airbnb Scraper tutorial](
https://blog.apify.com/how-to-scrape-airbnb-listings-and-reviews/
). Once you're done with scraping, see how the extracted data is used in [traveling and tourism](https://apify.com/industries/travel-and-logistics) industries.

## Input parameters

There are two ways you can scrape Airbnb:
 1. by **`locationQuery`** parameter - will get you all available listings for a given location (city, town). 
 2.  or by **`startUrls`** parameter - will get you all details from a single listing URL. Can be used only for 
 
### How to get all listings for given location:
It is super easy to get all Airbnb listings for a location. Just use `locationQuery` parameter - enter the city name as you would enter it on a search bar on a website. 

If you are looking for more specific results, then you can also add optional parameters:

-  `checkIn` - `checkOut` dates.
- `includeCalendar` will include the data on available range of days.
- `currency` will scrape the results in the currency of choice.
- `minPrice` - `maxPrice` - use this pair to specify the price range.
- `includeReviews` and `maxReviews` will set the necessity and amount of reviews to scrape.
- `simple` - will get only the main Airbnb listing data and skip the details.
- `addMoreHostInfo` will add details for the primary host such as host URL and number of listings. Will only work if the `simple` parameter is not enabled.
- `proxyConfiguration` will set Apify Proxy or your custom Proxy.

### Input example (locationQuery)

```json
{
  "simple": true,
  "includeReviews": true,
  "includeCalendar": false,
  "addMoreHostInfo": false,
  "currency": "USD",
  "proxyConfiguration": {
    "useApifyProxy": true
  },
  "maxListings": 50,
  "maxConcurrency": 50,
  "limitPoints": 100,
  "timeoutMs": 60000,
  "debugLog": false,
  "maxReviews": 15,
  "checkIn": "2022-05-06",
  "checkOut": "2022-05-16",
  "maxPrice": 100,
  "locationQuery": "New York",
  "minPrice": 0
}

```

### Get listing detail for a list of URLs

It is also easy to get all details for a specific listing. Just use **`startUrls`** parameter - enter the URL of the home listing you want to scrape. Note that this parameter only accepts direct listing URLs. Using `startUrls` input parameter, you can:

- scrape just one URL (one Airbnb listing).
- scrape multiple URLs in parallel by adding more URL fields.
- for convenience, instead of adding multiple URL fields, you can also paste a link to Google Sheets or a CSV containing the list of your URLs.
- paste original or shortened abnb.me URLs.

You can include any parameters listed in the previous section as well. For the full list of optional parameters, their default values, and how to set the values of your own, see the [Input Schema tab](https://apify.com/dtrungtin/airbnb-scraper/input-schema#locationQuery).

### Input example (startURLs)

```json
{
  "simple": true,
  "includeReviews": true,
  "includeCalendar": true,
  "addMoreHostInfo": true,
  "currency": "USD",
  "proxyConfiguration": {
    "useApifyProxy": true
  },
  "maxListings": 50,
  "maxConcurrency": 50,
  "limitPoints": 100,
  "timeoutMs": 60000,
  "debugLog": false,
  "maxReviews": 20,
  "checkIn": "2022-05-06",
  "checkOut": "2022-05-16",
  "maxPrice": 150,
  "startUrls": [
    {
      "url": "https://www.airbnb.com/rooms/44799007?check_in=2022-05-06&check_out=2022-05-16&federated_search_id=515c24ee-36ef-4c91-bcc2-27d3378cf8ad&source_impression_id=p3_1644398714_7dT9%2FkKgLeA913DZ"
    }
  ],
  "locationQuery": "Sacramento",
  "minPrice": 0
}
```

##  Airbnb data output 

The output from Airbnb Scraper is stored in the dataset. After the run is finished, you can download the contents of the dataset in various data formats (JSON, CSV, XML, RSS, HTML Table).

### Output example (locationQuery)

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
- `startUrls` will only scrape from a URL of a specific listing. This parameter cannot be used for other URLs, such as search result URL, for instance. 

## Other travel industry scrapers

We have other tourism-related scrapers in stock for you, for instance, [Booking Scraper](https://apify.com/dtrungtin/booking-scraper) and [Tripadvisor Scraper](https://apify.com/maxcopell/tripadvisor). If you are interested in those, head over to browse through the [Travel Category](https://apify.com/store?category=TRAVEL)  in Apify Store.

## Your feedback

We’re always striving to improve the performance of our actors. For any technical feedback about the work of our Airbnb Scraper or reporting a bug, please create an issue on the  [Github page](https://github.com/dtrungtin/actor-airbnb-scraper) or email us at  `support@apify.com` and we’ll get to it.
