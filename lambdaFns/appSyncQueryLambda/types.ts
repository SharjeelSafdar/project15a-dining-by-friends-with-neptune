export type Arguments = {
  personId: string;
  person1Id: string;
  person2Id: string;
  cuisineIds: string[];
  restaurantId: string;
  numDays: number;
};

export enum QueryType {
  GET_PERSON = "getPerson",
  GET_FRIENDS = "getFriends",
  GET_FRIENDS_OF_FRIENDS = "getFriendsOfFriends",
  FIND_PATH_BETWEEN_PEOPLE = "findPathBetweenPeople",
  HIGHEST_RATED_RESTAURANT_BY_CUISINE = "highestRatedRestaurantByCuisine",
  HIGHEST_RATED_RESTAURANTS = "highestRatedRestaurants",
  NEWEST_RESTAURANT_REVIEWS = "newestRestaurantReviews",
  RESTAURANTS_BY_FRIENDS_RECOMMENDATIONS = "restaurantsByFriendsRecommendations",
  RESTAURANTS_BY_FRIENDS_REVIEW_RATINGS = "restaurantsByFriendsReviewRatings",
  RESTAURANTS_RATED_OR_REVIEWED_BY_FRIENDS_IN_X_DAYS = "restaurantsRatedOrReviewedByFriendsinXDays",
  GET_ALL_STATES = "getAllStates",
  GET_ALL_CITIES = "getAllCities",
  GET_ALL_CUISINES = "getAllCuisines",
  GET_ALL_RESTAURANTS = "getAllRestaurants",
  GET_ALL_PERSONS = "getAllPersons",
  GET_ALL_REVIEWS = "getAllReviews",
  GET_ALL_REVIEW_RATINGS = "getAllReviewRatings",
}
