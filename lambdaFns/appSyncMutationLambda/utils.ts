import * as gremlin from "gremlin";

import { Details, MutationType } from "./types";

const __ = gremlin.process.statics;
const {
  cardinality: { single },
} = gremlin.process;

export const getConnectionDetails = () => {
  const uri = `wss://${process.env.NEPTUNE_WRITER}/gremlin`;
  return { uri, headers: {} };
};

export const createRemoteConnection = () => {
  const { uri, headers } = getConnectionDetails();

  return new gremlin.driver.DriverRemoteConnection(uri, {
    mimeType: "application/vnd.gremlin-v2.0+json",
    pingEnabled: false,
    headers: headers,
  });
};

export const createGraphTraversalSource = (
  conn: gremlin.driver.DriverRemoteConnection
) => {
  return gremlin.process.traversal().withRemote(conn);
};

export const idAlreadyExists = async (
  g: gremlin.process.GraphTraversalSource,
  args: Details
) => {
  const result = await g.V().has("id", args.id).next();
  console.log("Id Exists ==> ", !!result.value);
  return !!result.value;
};

export const runQuery = async (
  g: gremlin.process.GraphTraversalSource,
  mutationType: string,
  args: Details
) => {
  switch (mutationType) {
    case MutationType.ADD_PERSON: {
      const result = await g
        .addV("person")
        .property("id", args.id)
        .property("username", args.newPerson.username)
        .property("email", args.newPerson.email)
        .property("firstName", args.newPerson.firstName)
        .property("lastName", args.newPerson.lastName)
        .addE("livesIn")
        .to(__.V().has("city", "id", args.newPerson.cityId))
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        id: args.id,
        username: args.newPerson.username,
        email: args.newPerson.email,
        firstName: args.newPerson.firstName,
        lastName: args.newPerson.lastName,
        cityId: args.cityId,
        label: "person",
      };
    }
    case MutationType.ADD_UPDATE_FIRST_NAME: {
      const result = await g
        .V()
        .has("person", "id", args.personId)
        .property(single, "firstName", args.firstName)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        personId: args.personId,
        firstName: args.firstName,
      };
    }
    case MutationType.ADD_UPDATE_LAST_NAME: {
      const result = await g
        .V()
        .has("person", "id", args.personId)
        .property(single, "lastName", args.lastName)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        personId: args.personId,
        lastName: args.lastName,
      };
    }
    case MutationType.DELETE_PERSON: {
      const result = await g
        .V()
        .has("person", "id", args.personId)
        .drop()
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        personId: args.personId,
      };
    }
    case MutationType.ADD_CITY: {
      const result = await g
        .addV("city")
        .property("id", args.id)
        .property("name", args.name)
        .addE("within")
        .to(__.V().has("state", "id", args.stateId))
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        id: args.id,
        name: args.name,
        stateId: args.stateId,
        label: "city",
      };
    }
    case MutationType.UPDATE_CITY_NAME: {
      const result = await g
        .V()
        .has("city", "id", args.cityId)
        .property(single, "name", args.newName)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        cityId: args.cityId,
        name: args.newName,
      };
    }
    case MutationType.DELETE_CITY: {
      const result = await g.V().has("city", "id", args.cityId).drop().next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        cityId: args.cityId,
      };
    }
    case MutationType.ADD_STATE: {
      const result = await g
        .addV("state")
        .property("id", args.id)
        .property("name", args.name)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        id: args.id,
        name: args.name,
        label: "state",
      };
    }
    case MutationType.UPDATE_STATE_NAME: {
      const result = await g
        .V()
        .has("state", "id", args.stateId)
        .property(single, "name", args.newName)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        stateId: args.stateId,
        name: args.newName,
      };
    }
    case MutationType.DELETE_STATE: {
      const result = await g.V().has("state", "id", args.stateId).drop().next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        stateId: args.stateId,
      };
    }
    case MutationType.ADD_CUISINE: {
      const result = await g
        .addV("cuisine")
        .property("id", args.id)
        .property("name", args.name)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        id: args.id,
        name: args.name,
        label: "cuisine",
      };
    }
    case MutationType.UPDATE_CUISINE_NAME: {
      const result = await g
        .V()
        .has("cuisine", "id", args.cuisineId)
        .property(single, "name", args.newName)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        cuisineId: args.cuisineId,
        name: args.newName,
      };
    }
    case MutationType.DELETE_CUISINE: {
      const result = await g
        .V()
        .has("cuisine", "id", args.cuisineId)
        .drop()
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        cuisineId: args.cuisineId,
      };
    }
    case MutationType.ADD_RESTAURANT: {
      const result = await g
        .addV("restaurant")
        .property("id", args.id)
        .property("name", args.newRestaurant.name)
        .property("address", args.newRestaurant.address)
        .union(
          __.addE("within").to(
            __.V().has("city", "id", args.newRestaurant.cityId)
          ),
          __.addE("serves").to(
            __.V().has("cuisine", "id", args.newRestaurant.cuisineId)
          )
        )
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        id: args.id,
        name: args.newRestaurant.name,
        address: args.newRestaurant.address,
        cityId: args.newRestaurant.cityId,
        cuisineId: args.newRestaurant.cuisineId,
        label: "restaurant",
      };
    }
    case MutationType.UPDATE_RESTAURANT_NAME: {
      const result = await g
        .V()
        .has("restaurant", "id", args.restaurantId)
        .property(single, "name", args.newName)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        restaurantId: args.restaurantId,
        name: args.newName,
      };
    }
    case MutationType.UPDATE_RESTAURANT_ADDRESS: {
      const result = await g
        .V()
        .has("restaurant", "id", args.restaurantId)
        .property(single, "address", args.newAddress)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        restaurantId: args.restaurantId,
        address: args.newAddress,
      };
    }
    case MutationType.DELETE_RESTAURANT: {
      const result = await g
        .V()
        .has("restaurant", "id", args.restaurantId)
        .drop()
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        restaurantId: args.restaurantId,
      };
    }
    case MutationType.ADD_REVIEW: {
      const result = await g
        .addV("review")
        .property("id", args.id)
        .property("createdAt", args.createdAt)
        .property("rating", args.newReview.rating)
        .property("body", args.newReview.body)
        .union(
          __.addE("about").to(
            __.V().has("restaurant", "id", args.newReview.restaurantId)
          ),
          __.addE("wrote").from_(
            __.V().has("person", "id", args.newReview.personId)
          )
        )
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        id: args.id,
        createdAt: args.createdAt,
        rating: args.newReview.rating,
        body: args.newReview.body,
        restaurantId: args.newReview.restaurantId,
        personId: args.newReview.personId,
        label: "review",
      };
    }
    case MutationType.DELETE_REVIEW: {
      const result = await g
        .V()
        .has("review", "id", args.reviewId)
        .drop()
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        reviewId: args.reviewId,
      };
    }
    case MutationType.ADD_REVIEW_RATING: {
      const result = await g
        .addV("reviewRating")
        .property("id", args.id)
        .property("reviewDate", args.reviewDate)
        .property("thumbsUp", args.newReviewRating.thumbsUp)
        .union(
          __.addE("about").to(
            __.V().has("review", "id", args.newReviewRating.reviewId)
          ),
          __.addE("wrote")
            .from_(__.V().has("person", "id", args.newReviewRating.personId))
            .property("reviewDate", args.reviewDate)
        )
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        id: args.id,
        reviewDate: args.reviewDate,
        thumbsUp: args.newReviewRating.thumbsUp,
        reviewId: args.newReviewRating.reviewId,
        personId: args.newReviewRating.personId,
        label: "reviewRating",
      };
    }
    case MutationType.DELETE_REVIEW_RATING: {
      const result = await g
        .V()
        .has("reviewRating", "id", args.reviewRatingId)
        .drop()
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        reviewRatingId: args.reviewRatingId,
      };
    }
    case MutationType.ADD_FRIENDS_EDGE: {
      const isAlreadyFriend = await g
        .V()
        .has("person", "id", args.fromId)
        .out("friends")
        .has("person", "id", args.toId)
        .toList();
      console.log({ isAlreadyFriend });
      if (isAlreadyFriend.length > 0) {
        console.warn("Already friend... returning without any action...");
        return;
      }

      const result = await g
        .addE("friends")
        .from_(__.V().has("person", "id", args.fromId))
        .to(__.V().has("person", "id", args.toId))
        .property("id", args.id)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        edgeId: args.id,
        fromID: args.fromId,
        toId: args.toId,
        label: "friends",
      };
    }
    case MutationType.DELETE_FRIENDS_EDGE: {
      const result = await g
        .E()
        .has("friends", "id", args.friendsEdgeId)
        .drop()
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        friendsEdgeId: args.friendsEdgeId,
      };
    }
    default: {
      return;
    }
  }
};
