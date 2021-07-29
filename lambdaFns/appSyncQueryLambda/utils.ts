import * as gremlin from "gremlin";

import { Arguments, QueryType } from "./types";

const __ = gremlin.process.statics;
const {
  P: { within, gte },
  order: { desc },
  column: { keys, values },
  traversal,
} = gremlin.process;
const { Graph } = gremlin.structure;

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
    case QueryType.GET_PERSON: {
      const result = await g
        .V()
        .has("person", "id", args.personId)
        .elementMap("id", "username", "email", "firstName", "lastName")
        .next();
      console.log("Person By ID ==> ", result.value);
      return result.value;
    }
    case QueryType.GET_FRIENDS: {
      const result = await g
        .V()
        .has("person", "id", args.personId)
        .out("friends")
        .elementMap("id", "username", "email", "firstName", "lastName")
        .toList();
      console.log("All friends of a person ==> ", result);
      return result;
    }
    case QueryType.GET_FRIENDS_OF_FRIENDS: {
      const result = await g
        .V()
        .has("person", "id", args.personId)
        .out("friends")
        .out("friends")
        .dedup()
        .elementMap("id", "username", "email", "firstName", "lastName")
        .toList();
      console.log("All friends of friends of a person ==> ", result);
      return result;
    }
    case QueryType.FIND_PATH_BETWEEN_PEOPLE: {
      const result = await g
        .V()
        .has("person", "id", args.person1Id)
        .until(__.has("person", "id", args.person2Id))
        .repeat(__.both("friends").simplePath())
        .path()
        .toList();
      console.log("Path between the persons ==> ", result);
      return result;
    }
    case QueryType.HIGHEST_RATED_RESTAURANT_BY_CUISINE: {
      const result = await g
        .V()
        .has("person", "id", args.personId)
        .out("livesIn")
        .in_("within")
        .where(__.out("serves").has("id", within(args.cuisineIds)))
        .where(__.inE("about"))
        .group()
        .by(__.identity())
        .by(__.in_("about").values("rating").mean())
        .unfold()
        .order()
        .by(values, desc)
        .limit(1)
        .project("id", "name", "address", "averageRating", "cuisine")
        .by(__.select(keys).values("id"))
        .by(__.select(keys).values("name"))
        .by(__.select(keys).values("address"))
        .by(__.select(values))
        .by(__.select(keys).out("serves").values("name"))
        .next();
      console.log("Highest rated restaurant by cuisine ==> ", result.value);
      return result.value;
    }
    case QueryType.HIGHEST_RATED_RESTAURANTS: {
      const result = await g
        .V()
        .has("person", "id", args.personId)
        .out("livesIn")
        .in_("within")
        .where(__.inE("about"))
        .group()
        .by(__.identity())
        .by(__.in_("about").values("rating").mean())
        .unfold()
        .order()
        .by(values, desc)
        .limit(10)
        .project("id", "name", "address", "averageRating")
        .by(__.select(keys).values("id"))
        .by(__.select(keys).values("name"))
        .by(__.select(keys).values("address"))
        .by(__.select(values))
        .toList();
      console.log("Top 10 highest rated restaurant ==> ", result);
      return result;
    }
    case QueryType.NEWEST_RESTAURANT_REVIEWS: {
      const result = await g
        .V()
        .has("restaurant", "id", args.restaurantId)
        .in_("about")
        .unfold()
        .order()
        .by("createdAt", desc)
        .limit(3)
        .elementMap("id", "createdAt", "rating", "body")
        .toList();
      console.log("Top 3 newest restaurant reviews ==> ", result);
      return result;
    }
    case QueryType.RESTAURANTS_BY_FRIENDS_RECOMMENDATIONS: {
      const { value: cityId } = await g
        .V()
        .has("person", "id", args.personId)
        .out("livesIn")
        .values("id")
        .next();
      const result = await g
        .V()
        .has("person", "id", args.personId)
        .out("friends")
        .out("wrote")
        .optional(__.hasLabel("reviewRating").out("about"))
        .out("about")
        .where(__.out("within").has("city", "id", cityId))
        .group()
        .by(__.identity())
        .by(__.in_("about").values("rating").mean())
        .unfold()
        .order()
        .by(values, desc)
        .limit(3)
        .project("id", "name", "address", "averageRating")
        .by(__.select(keys).values("id"))
        .by(__.select(keys).values("name"))
        .by(__.select(keys).values("address"))
        .by(__.select(values))
        .toList();
      console.log("Top 3 restaurant recommended by friends ==> ", result);
      return result;
    }
    case QueryType.RESTAURANTS_BY_FRIENDS_REVIEW_RATINGS: {
      const cityId = await g
        .V()
        .has("person", "id", args.personId)
        .out("livesIn")
        .values("id")
        .next();
      const subGraph = await g
        .V()
        .has("person", "id", args.personId)
        .bothE("friends")
        .subgraph("sg")
        .otherV()
        .outE("wrote")
        .subgraph("sg")
        .inV()
        .optional(
          __.hasLabel("reviewRating").outE("about").subgraph("sg").inV()
        )
        .outE("about")
        .subgraph("sg")
        .inV()
        .outE("within")
        .subgraph("sg")
        .cap("sg")
        .next();
      const sg = traversal().withGraph(subGraph.value);
      const result = await sg
        .V()
        .has("person", "id", args.personId)
        .both("friends")
        .has("city", "id", cityId)
        .in_("within")
        .group()
        .by(__.identity())
        .by(__.in_("about").values("rating").mean())
        .unfold()
        .order()
        .by(values, desc)
        .limit(3)
        .project("id", "name", "address", "averageRating")
        .by(__.select(keys).values("id"))
        .by(__.select(keys).values("name"))
        .by(__.select(keys).values("address"))
        .by(__.select(values))
        .toList();
      console.log("Top 3 restaurant based on friends' reviews ==> ", result);
      return result;
    }
    case QueryType.RESTAURANTS_RATED_OR_REVIEWED_BY_FRIENDS_IN_X_DAYS: {
      const timeBenchmark =
        Math.round(Date.now() / 1000) - args.numDays * 24 * 60 * 60;
      const result = await g
        .V()
        .has("person", "id", args.personId)
        .out("friends")
        .out("wrote")
        .union(
          __.has("review", "createdAt", gte(timeBenchmark)),
          __.has("reviewRating", "reviewDate", gte(timeBenchmark)).out("about")
        )
        .out("about")
        .dedup()
        .unfold()
        .order()
        .by("name")
        .elementMap("id", "name", "address")
        .toList();
      console.log(
        "Restaurants reviewed by friends in last X days ==> ",
        result
      );
      return result;
    }
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
