import { EventBridgeHandler } from "aws-lambda";

export type Handler = EventBridgeHandler<string, Details, any>;

type NewPerson = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  cityId: string;
};

type NewRestaurant = {
  name: string;
  address: string;
  cityId: string;
  cuisineId: string;
};

type NewReview = {
  rating: number;
  body: string;
  personId: string;
  restaurantId: string;
};

type NewReviewRating = {
  thumbsUp: boolean;
  personId: string;
  reviewId: string;
};

export type Details = {
  newPerson: NewPerson;
  id: string;
  name: string;
  cityId: string;
  stateId: string;
  personId: string;
  firstName: string;
  lastName: string;
  newName: string;
  cuisineId: string;
  newRestaurant: NewRestaurant;
  restaurantId: string;
  newAddress: string;
  newReview: NewReview;
  createdAt: number;
  reviewId: string;
  newReviewRating: NewReviewRating;
  reviewDate: number;
  reviewRatingId: string;
  fromId: string;
  toId: string;
  friendsEdgeId: string;
};

export enum MutationType {
  ADD_PERSON = "addPerson",
  ADD_UPDATE_FIRST_NAME = "addUpdateFirstName",
  ADD_UPDATE_LAST_NAME = "addUpdateLastName",
  DELETE_PERSON = "deletePerson",
  ADD_CITY = "addCity",
  UPDATE_CITY_NAME = "updateCityName",
  DELETE_CITY = "deleteCity",
  ADD_STATE = "addState",
  UPDATE_STATE_NAME = "updateStateName",
  DELETE_STATE = "deleteState",
  ADD_CUISINE = "addCuisine",
  UPDATE_CUISINE_NAME = "updateCuisineName",
  DELETE_CUISINE = "deleteCuisine",
  ADD_RESTAURANT = "addRestaurant",
  UPDATE_RESTAURANT_NAME = "updateRestaurantName",
  UPDATE_RESTAURANT_ADDRESS = "updateRestaurantAddress",
  DELETE_RESTAURANT = "deleteRestaurant",
  ADD_REVIEW = "addReview",
  DELETE_REVIEW = "deleteReview",
  ADD_REVIEW_RATING = "addReviewRating",
  DELETE_REVIEW_RATING = "deleteReviewRating",
  ADD_FRIENDS_EDGE = "addFriendsEdge",
  DELETE_FRIENDS_EDGE = "deleteFriendsEdge",
}
