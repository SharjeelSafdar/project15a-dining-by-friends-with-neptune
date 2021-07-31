Feature: DiningByFriends GraphQL API Queries Tests
  Background:
    * url 'https://hyqc2zqqrfbqdjm54stk6aetsq.appsync-api.us-east-2.amazonaws.com/graphql'
    * header x-api-key = 'da2-k54eqwmr4ve73omwv5j6xo5tyq'

  Scenario: Get All States Query
    * text query = 
      """
        query MyQuery {
          getAllStates {
            id
            label
            name
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { getAllStates: "#notnull" }
    * match response.data == { getAllStates: "#array" }
    * match response.data.getAllStates[0] == { id: "#uuid", name: "#string", label: "state" }

  Scenario: Get All Cities Query
    * text query = 
      """
        query MyQuery {
          getAllCities {
            id
            label
            name
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { getAllCities: "#notnull" }
    * match response.data == { getAllCities: "#array" }
    * match response.data.getAllCities[0] == { id: "#uuid", name: "#string", label: "city" }

  Scenario: Get All Cuisines Query
    * text query = 
      """
        query MyQuery {
          getAllCuisines {
            id
            label
            name
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { getAllCuisines: "#notnull" }
    * match response.data == { getAllCuisines: "#array" }
    * match response.data.getAllCuisines[0] == { id: "#uuid", name: "#string", label: "cuisine" }

  Scenario: Get All Restaurants Query
    * text query = 
      """
        query MyQuery {
          getAllRestaurants {
            id
            label
            name
            address
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { getAllRestaurants: "#notnull" }
    * match response.data == { getAllRestaurants: "#array" }
    * match response.data.getAllRestaurants[0] == { id: "#uuid", name: "#string", label: "restaurant", address: "#string" }

  Scenario: Get All Persons Query
    * text query = 
      """
        query MyQuery {
          getAllPersons {
            id
            label
            username
            email
            firstName
            lastName
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { getAllPersons: "#notnull" }
    * match response.data == { getAllPersons: "#array" }
    * match response.data.getAllPersons[0] == { id: "#uuid", label: "person", username: "#string", email: "#string", firstName: "#string", lastName: "#string" }

  Scenario: Get All Reviews Query
    * text query = 
      """
        query MyQuery {
          getAllReviews {
            id
            label
            createdAt
            rating
            body
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { getAllReviews: "#notnull" }
    * match response.data == { getAllReviews: "#array" }
    * match response.data.getAllReviews[0] == { id: "#uuid", label: "review", createdAt: "#number", rating: "#number", body: "#string" }

  Scenario: Get All Review Ratings Query
    * text query = 
      """
        query MyQuery {
          getAllReviewRatings {
            id
            label
            reviewDate
            thumbsUp
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { getAllReviewRatings: "#notnull" }
    * match response.data == { getAllReviewRatings: "#array" }

  Scenario: Get a Person By Id Query
    * text query = 
      """
        query MyQuery {
          getPerson(personId: "d5d57338-cdbb-41f4-9f76-b78b7aa3535f") {
            id
            label
            username
            email
            firstName
            lastName
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { getPerson: "#notnull" }
    * match response.data == { getPerson: "#object" }
    * match response.data.getPerson == { id: "#uuid", label: "person", username: "#string", email: "#string", firstName: "#string", lastName: "#string" }

  Scenario: Get all Friends of a Person By Id Query
    * text query = 
      """
        query MyQuery {
          getFriends(personId: "d5d57338-cdbb-41f4-9f76-b78b7aa3535f") {
            id
            label
            username
            email
            firstName
            lastName
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { getFriends: "#notnull" }
    * match response.data == { getFriends: "#array" }
    * match response.data.getFriends[0] == { id: "#uuid", label: "person", username: "#string", email: "#string", firstName: "#string", lastName: "#string" }

  Scenario: Get all Friends of Friends of a Person By Id Query
    * text query = 
      """
        query MyQuery {
          getFriendsOfFriends(personId: "d5d57338-cdbb-41f4-9f76-b78b7aa3535f") {
            id
            label
            username
            email
            firstName
            lastName
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { getFriendsOfFriends: "#notnull" }
    * match response.data == { getFriendsOfFriends: "#array" }
    * match response.data.getFriendsOfFriends[0] == { id: "#uuid", label: "person", username: "#string", email: "#string", firstName: "#string", lastName: "#string" }

  Scenario: Find all Possible Simple Paths Between Two Persons By Ids Query
    * text query = 
      """
        query MyQuery {
          findPathBetweenPeople(
            person1Id: "d5d57338-cdbb-41f4-9f76-b78b7aa3535f"
            person2Id: "98ec780f-6ec6-4d8f-ab15-8788a944f978"
          )
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { findPathBetweenPeople: "#notnull" }
    * match response.data == { findPathBetweenPeople: "#array" }
    * match response.data.findPathBetweenPeople[0] == "#string"

  Scenario: Get the Highest Rated Restaurant With a Specific Cuisine Query
    * text query = 
      """
        query MyQuery {
          highestRatedRestaurantByCuisine(
            personId: "d5d57338-cdbb-41f4-9f76-b78b7aa3535f"
            cuisineIds: ["7a5b7076-2618-4b74-8222-616d04a7d1c2", "5d64698c-bab8-4c54-a917-4c927ad6cde8"]
          ) {
            id
            label
            name
            address
            cuisine
            averageRating
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { highestRatedRestaurantByCuisine: "#notnull" }
    * match response.data == { highestRatedRestaurantByCuisine: "#object" }
    * match response.data.highestRatedRestaurantByCuisine == { id: "#uuid", name: "#string", label: "restaurant", address: "#string", cuisine: "#string", averageRating: "#? _ > 0 && _ <= 5" }

  Scenario: Get the Highest Rated Restaurants in a Person's Locale Query
    * text query = 
      """
        query MyQuery {
          highestRatedRestaurants(personId: "d5d57338-cdbb-41f4-9f76-b78b7aa3535f") {
            id
            label
            name
            address
            cuisine
            averageRating
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { highestRatedRestaurants: "#notnull" }
    * match response.data == { highestRatedRestaurants: "#array" }
    * match response.data.highestRatedRestaurants[0] == { id: "#uuid", label: "restaurant", name: "#string", address: "#string", cuisine: "#string", averageRating: "#number? _ > 0 && _ <= 5" }

  Scenario: Get the Newest Reviews for a Restaurant Query
    * text query = 
      """
        query MyQuery {
          newestRestaurantReviews(
            restaurantId: "9888df3e-fb6d-4b97-982a-ca5e9f2d3da3"
          ) {
            id
            label
            createdAt
            rating
            body
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { newestRestaurantReviews: "#notnull" }
    * match response.data == { newestRestaurantReviews: "#array" }
    * match response.data.newestRestaurantReviews[0] == { id: "#uuid", label: "review", createdAt: "#number", rating: "#number? _ > 0 && _ <= 5", body: "#string" }

  Scenario: Get Restaurants Based on Friends' Recommendations Query
    * text query = 
      """
        query MyQuery {
          restaurantsByFriendsRecommendations(
            personId: "d5d57338-cdbb-41f4-9f76-b78b7aa3535f"
          ) {
            id
            label
            name
            address
            cuisine
            averageRating
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { restaurantsByFriendsRecommendations: "#notnull" }
    * match response.data == { restaurantsByFriendsRecommendations: "#array" }
    * match response.data.restaurantsByFriendsRecommendations[0] == { id: "#uuid", label: "restaurant", name: "#string", address: "#string", cuisine: "#string", averageRating: "#number? _ > 0 && _ <= 5" }

  Scenario: Get Restaurants Based on Friends' Reviews Query
    * text query = 
      """
        query MyQuery {
          restaurantsByFriendsReviewRatings(
            personId: "d5d57338-cdbb-41f4-9f76-b78b7aa3535f"
          ) {
            id
            label
            name
            address
            cuisine
            averageRating
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { restaurantsByFriendsReviewRatings: "#notnull" }
    * match response.data == { restaurantsByFriendsReviewRatings: "#array" }
    * match response.data.restaurantsByFriendsReviewRatings[0] == { id: "#uuid", label: "restaurant", name: "#string", address: "#string", cuisine: "#string", averageRating: "#number? _ > 0 && _ <= 5" }

  Scenario: Get Restaurants Reviewed by Friends in Past X Days Query
    * text query = 
      """
        query MyQuery {
          restaurantsRatedOrReviewedByFriendsinXDays(
            personId: "d5d57338-cdbb-41f4-9f76-b78b7aa3535f"
            numDays: 10
          ) {
            id
            label
            name
            address
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { restaurantsRatedOrReviewedByFriendsinXDays: "#notnull" }
    * match response.data == { restaurantsRatedOrReviewedByFriendsinXDays: "#array" }
    * match response.data.restaurantsRatedOrReviewedByFriendsinXDays[0] == { id: "#uuid", label: "restaurant", name: "#string", address: "#string" }
