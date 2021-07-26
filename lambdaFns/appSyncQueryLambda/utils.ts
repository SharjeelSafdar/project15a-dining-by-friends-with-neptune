import * as gremlin from "gremlin";

import { Arguments, QueryType } from "./types";

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

export const runQuery = async (
  g: gremlin.process.GraphTraversalSource,
  queryType: string,
  args: Arguments
) => {
  switch (queryType) {
    case QueryType.GET_ALL_STATES: {
      const result = await g
        .V()
        .hasLabel("state")
        .elementMap("id", "name")
        .toList();
      console.log("All States ==> ", result);
      return result;
    }
    case QueryType.GET_ALL_CITIES: {
      const result = await g
        .V()
        .hasLabel("city")
        .elementMap("id", "name")
        .toList();
      console.log("All Cities ==> ", result);
      return result;
    }
    case QueryType.GET_ALL_CUISINES: {
      const result = await g
        .V()
        .hasLabel("cuisine")
        .elementMap("id", "name")
        .toList();
      console.log("All Cuisines ==> ", result);
      return result;
    }
    case QueryType.GET_ALL_RESTAURANTS: {
      const result = await g
        .V()
        .hasLabel("restaurant")
        .elementMap("id", "name", "address")
        .toList();
      console.log("All Restaurants ==> ", result);
      return result;
    }
    case QueryType.GET_ALL_PERSONS: {
      const result = await g
        .V()
        .hasLabel("person")
        .elementMap("id", "username", "email", "firstName", "lastName")
        .toList();
      console.log("All Persons ==> ", result);
      return result;
    }
    case QueryType.GET_ALL_REVIEWS: {
      const result = await g
        .V()
        .hasLabel("review")
        .elementMap("id", "createdAt", "rating", "body")
        .toList();
      console.log("All Reviews ==> ", result);
      return result;
    }
    case QueryType.GET_ALL_REVIEW_RATINGS: {
      const result = await g
        .V()
        .hasLabel("reviewRating")
        .elementMap("id", "thumbsUp", "reviewDate")
        .toList();
      console.log("All Review Ratings ==> ", result);
      return result;
    }
    default: {
      return;
    }
  }
};
